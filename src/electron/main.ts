import { app, BrowserWindow, ipcMain, nativeImage, dialog, Menu, MenuItemConstructorOptions } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import fs from 'fs/promises';
import { existsSync } from 'fs';

app.commandLine.appendSwitch('disable-logging')


const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

type Project = {
    id: string;
    name: string;
    path: string;
};

// ESM-safe __filename/__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getProjectsRoot(): string {
    return path.join(app.getPath('userData'), 'projects');
}

async function ensureProjectsRoot(): Promise<string> {
    const root = getProjectsRoot();
    if (!existsSync(root)) {
        await fs.mkdir(root, { recursive: true });
    }
    return root;
}

async function listProjects(): Promise<Project[]> {
    const root = await ensureProjectsRoot();
    const entries = await fs.readdir(root, { withFileTypes: true });
    const projects: Project[] = [];
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const dirName = entry.name;
            const fullPath = path.join(root, dirName);
            projects.push({ id: dirName, name: dirName, path: fullPath });
        }
    }
    return projects;
}

async function createProject(requestedName: string): Promise<Project> {
    const root = await ensureProjectsRoot();
    const baseName = requestedName.trim() || 'Untitled Project';
    let candidate = baseName;
    let suffix = 2;
    while (existsSync(path.join(root, candidate))) {
        candidate = `${baseName} (${suffix})`;
        suffix += 1;
    }
    const projectDir = path.join(root, candidate);
    await fs.mkdir(projectDir, { recursive: true });
    return { id: candidate, name: candidate, path: projectDir };
}

async function deleteProject(projectIdOrPath: string): Promise<{ ok: true }> {
    const root = await ensureProjectsRoot();
    // If path points inside root, use as-is; else treat as id under root
    const candidatePath = projectIdOrPath.startsWith(root)
        ? projectIdOrPath
        : path.join(root, projectIdOrPath);
    if (!candidatePath.startsWith(root)) {
        throw new Error('Invalid path');
    }
    if (!existsSync(candidatePath)) {
        return { ok: true };
    }
    await fs.rm(candidatePath, { recursive: true, force: true });
    return { ok: true };
}

async function importPdfIntoProject(projectId: string): Promise<{ imported: { fileName: string; path: string }[] }>
{
    const root = await ensureProjectsRoot();
    const projectDir = path.join(root, projectId);
    if (!existsSync(projectDir)) {
        throw new Error('Project not found');
    }

    const focused = BrowserWindow.getFocusedWindow();
    const dialogOptions: Electron.OpenDialogOptions = {
        title: 'Select PDF to import',
        properties: ['openFile'],
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
    };
    const result = focused
        ? await dialog.showOpenDialog(focused, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled || result.filePaths.length === 0) {
        return { imported: [] };
    }

    const srcPath = result.filePaths[0];
    const baseName = path.basename(srcPath, path.extname(srcPath));
    const ext = '.pdf';
    let destName = baseName + ext;
    let candidate = path.join(projectDir, destName);
    let suffix = 2;
    while (existsSync(candidate)) {
        destName = `${baseName} (${suffix})${ext}`;
        candidate = path.join(projectDir, destName);
        suffix += 1;
    }
    await fs.copyFile(srcPath, candidate);
    return { imported: [{ fileName: destName, path: candidate }] };
}

async function projectHasItems(projectId: string): Promise<{ hasItems: boolean }> {
    const root = await ensureProjectsRoot();
    const projectDir = path.join(root, projectId);
    if (!existsSync(projectDir)) return { hasItems: false };
    const entries = await fs.readdir(projectDir, { withFileTypes: true });
    for (const e of entries) {
        if (e.isFile() && e.name.toLowerCase().endsWith('.pdf')) {
            return { hasItems: true };
        }
    }
    return { hasItems: false };
}

async function listProjectItems(projectId: string): Promise<{ items: { fileName: string; path: string }[] }> {
    const root = await ensureProjectsRoot();
    const projectDir = path.join(root, projectId);
    if (!existsSync(projectDir)) return { items: [] };
    const entries = await fs.readdir(projectDir, { withFileTypes: true });
    const items = entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.pdf'))
        .map((e) => ({ fileName: e.name, path: path.join(projectDir, e.name) }));
    return { items };
}

// Highlights persistence per project and file
type HighlightRecord = {
    id: string;
    position: unknown;
    content: unknown;
    comment?: unknown;
};

async function readHighlights(projectId: string, pdfFileName: string): Promise<HighlightRecord[]> {
    const root = await ensureProjectsRoot();
    const projectDir = path.join(root, projectId);
    if (!existsSync(projectDir)) return [];
    const storeFile = path.join(projectDir, 'highlights', `${pdfFileName}.json`);
    if (!existsSync(storeFile)) return [];
    try {
        const text = await fs.readFile(storeFile, 'utf-8');
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed as HighlightRecord[];
    } catch {}
    return [];
}

async function writeHighlights(projectId: string, pdfFileName: string, highlights: HighlightRecord[]): Promise<{ ok: true }> {
    const root = await ensureProjectsRoot();
    const projectDir = path.join(root, projectId);
    const hlDir = path.join(projectDir, 'highlights');
    await fs.mkdir(hlDir, { recursive: true });
    const storeFile = path.join(hlDir, `${pdfFileName}.json`);
    await fs.writeFile(storeFile, JSON.stringify(highlights ?? [], null, 2), 'utf-8');
    return { ok: true };
}

// Kanban status persistence
async function readKanbanStatuses(projectId: string): Promise<Record<string, string>> {
    const root = await ensureProjectsRoot();
    const projectDir = path.join(root, projectId);
    if (!existsSync(projectDir)) return {};
    const file = path.join(projectDir, 'kanban.json');
    if (!existsSync(file)) return {};
    try {
        const text = await fs.readFile(file, 'utf-8');
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object') return parsed as Record<string, string>;
    } catch {}
    return {};
}

async function writeKanbanStatuses(projectId: string, statuses: Record<string, string>): Promise<{ ok: true }> {
    const root = await ensureProjectsRoot();
    const projectDir = path.join(root, projectId);
    await fs.mkdir(projectDir, { recursive: true });
    const file = path.join(projectDir, 'kanban.json');
    await fs.writeFile(file, JSON.stringify(statuses, null, 2), 'utf-8');
    return { ok: true };
}


app.on('ready', () => {
    // In development, set the app/dock icon from the project root DocIcon.png
    if (isDev) {
        const devIconPathPng = path.join(app.getAppPath(), 'DocIcon.png');
        const devIconPathIcns = path.join(app.getAppPath(), 'DocIcon.icns');
        if (process.platform === 'darwin' && app.dock) {
            let img: ReturnType<typeof nativeImage.createFromPath> | null = null;
            if (existsSync(devIconPathIcns)) {
                const maybeIcns = nativeImage.createFromPath(devIconPathIcns);
                if (!maybeIcns.isEmpty()) img = maybeIcns;
            }
            if (!img && existsSync(devIconPathPng)) {
                const maybePng = nativeImage.createFromPath(devIconPathPng);
                if (!maybePng.isEmpty()) img = maybePng;
            }
            if (img) {
                app.dock.setIcon(img);
            }
        }
    }

    const mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1400,
        minHeight: 900,
        title: '',
        backgroundColor: '#ffffff',
        ...(process.platform === 'darwin'
            ? {
                titleBarStyle: 'hidden' as const,
                titleBarOverlay: { color: '#ffffff', symbolColor: '#000000', height: 28 },
              }
            : {}),
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, 'preload.cjs'),
        },
        ...(isDev
            ? { icon: existsSync(path.join(app.getAppPath(), 'DocIcon.ico'))
                ? path.join(app.getAppPath(), 'DocIcon.ico')
                : path.join(app.getAppPath(), 'DocIcon.png') }
            : {}),
    });

    // Application menu to enable native shortcuts like Ctrl+C/Ctrl+V on Windows/Linux
    try {
        const template: MenuItemConstructorOptions[] = [];
        if (process.platform === 'darwin') {
            template.push({ role: 'appMenu' as const });
        }
        template.push(
            { role: 'fileMenu' as const },
            { role: 'editMenu' as const },
            { role: 'viewMenu' as const },
            { role: 'windowMenu' as const },
        );
        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    } catch {}
    if (isDev) {
        mainWindow.loadURL('http://localhost:5123');
    } else {
        mainWindow.loadFile(path.join(app.getAppPath() + '/dist-react/index.html'));

    }
    // Initialize electron-screenshots instance
    let screenshots: any | null = null;
    try {
        const require = createRequire(import.meta.url);
        const Screenshots = require('electron-screenshots');
        screenshots = new Screenshots();
    } catch (e) {
        // Failed to initialize screenshots tool; IPC will return an error
        screenshots = null;
    }
    // IPC handlers
    ipcMain.handle('projects:list', async () => {
        return listProjects();
    });
    ipcMain.handle('projects:create', async (_event, name: string) => {
        return createProject(name);
    });
    ipcMain.handle('projects:delete', async (_event, idOrPath: string) => {
        return deleteProject(idOrPath);
    });
    ipcMain.handle('projects:item:import-pdf', async (_event, projectId: string) => {
        return importPdfIntoProject(projectId);
    });
    ipcMain.handle('projects:items:exists', async (_event, projectId: string) => {
        return projectHasItems(projectId);
    });
    ipcMain.handle('projects:items:list', async (_event, projectId: string) => {
        return listProjectItems(projectId);
    });
    ipcMain.handle('projects:item:delete', async (_event, absolutePath: string) => {
        const root = await ensureProjectsRoot();
        const normalized = path.normalize(absolutePath);
        if (!normalized.startsWith(root)) {
            throw new Error('Access denied');
        }
        try {
            await fs.rm(normalized, { force: true });
        } catch {}
        return { ok: true } as const;
    });
    ipcMain.handle('projects:item:delete-all', async (_event, projectId: string, pdfFileName: string, absolutePath: string) => {
        const root = await ensureProjectsRoot();
        const normalized = path.normalize(absolutePath);
        if (!normalized.startsWith(root)) {
            throw new Error('Access denied');
        }
        try {
            await fs.rm(normalized, { force: true });
        } catch {}
        try {
            const projectDir = path.join(root, projectId);
            const hlFile = path.join(projectDir, 'highlights', `${pdfFileName}.json`);
            await fs.rm(hlFile, { force: true });
        } catch {}
        return { ok: true } as const;
    });
    ipcMain.handle('projects:kanban:get', async (_event, projectId: string) => {
        return readKanbanStatuses(projectId);
    });
    ipcMain.handle('projects:kanban:set', async (_event, projectId: string, statuses: Record<string, string>) => {
        return writeKanbanStatuses(projectId, statuses);
    });
    // Highlights IPC
    ipcMain.handle('projects:highlights:get', async (_event, projectId: string, pdfFileName: string) => {
        return readHighlights(projectId, pdfFileName);
    });
    ipcMain.handle('projects:highlights:set', async (_event, projectId: string, pdfFileName: string, highlights: HighlightRecord[]) => {
        return writeHighlights(projectId, pdfFileName, highlights);
    });
    ipcMain.handle('file:read-base64', async (_event, absolutePath: string) => {
        // Only allow reading files within userData/projects for safety
        const root = await ensureProjectsRoot();
        const normalized = path.normalize(absolutePath);
        if (!normalized.startsWith(root)) {
            throw new Error('Access denied');
        }
        const data = await fs.readFile(normalized);
        return data.toString('base64');
    });
    // Capture a rectangle within the current app window only
    ipcMain.handle('screenshot:capture-rect', async (_event, rect: { x: number; y: number; width: number; height: number }) => {
        try {
            const win = BrowserWindow.getFocusedWindow();
            if (!win) return { ok: false as const, error: 'No focused window' };
            // Guard invalid rect
            const x = Math.max(0, Math.floor(rect?.x ?? 0));
            const y = Math.max(0, Math.floor(rect?.y ?? 0));
            const width = Math.max(1, Math.floor(rect?.width ?? 1));
            const height = Math.max(1, Math.floor(rect?.height ?? 1));
            const image = await win.capturePage({ x, y, width, height });
            const base64 = image.toPNG().toString('base64');
            return { ok: true as const, dataUrl: `data:image/png;base64,${base64}`, rect: { x, y, width, height } };
        } catch (e) {
            return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
        }
    });
    // Screenshots IPC
    ipcMain.handle('screenshot:capture', async () => {
        if (!screenshots) {
            return { ok: false as const, error: 'Screenshots unavailable' };
        }
        try {
            screenshots.startCapture();
            const result: any = await new Promise((resolve) => {
                const onOk = (_e: unknown, buffer: Buffer, bounds: unknown) => {
                    try {
                        const base64 = Buffer.from(buffer).toString('base64');
                        resolve({ ok: true, dataUrl: `data:image/png;base64,${base64}`, bounds });
                    } catch {
                        resolve({ ok: false });
                    }
                };
                const onCancel = () => resolve({ ok: false });
                try {
                    screenshots.once('ok', onOk);
                    screenshots.once('cancel', onCancel);
                } catch {
                    resolve({ ok: false });
                }
            });
            return result;
        } catch (e) {
            return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
        }
    });
});