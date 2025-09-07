import { app, BrowserWindow, ipcMain, nativeImage, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
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


app.on('ready', () => {
    // In development, set the app/dock icon from the project root desktopIcon.png
    if (isDev) {
        const devIconPathPng = path.join(app.getAppPath(), 'desktopIcon.png');
        const devIconPathIcns = path.join(app.getAppPath(), 'desktopIcon.icns');
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
        width: 1200,
        height: 800,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, 'preload.cjs'),
        },
        ...(isDev
            ? { icon: existsSync(path.join(app.getAppPath(), 'desktopIcon.ico'))
                ? path.join(app.getAppPath(), 'desktopIcon.ico')
                : path.join(app.getAppPath(), 'desktopIcon.png') }
            : {}),
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:5123');
    } else {
        mainWindow.loadFile(path.join(app.getAppPath() + '/dist-react/index.html'));

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
});