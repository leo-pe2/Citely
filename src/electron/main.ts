import { app, BrowserWindow, ipcMain, nativeImage } from 'electron';
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

type ChildFolder = {
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

async function listChildFolders(categoryPath: string): Promise<ChildFolder[]> {
    const entries = await fs.readdir(categoryPath, { withFileTypes: true });
    const folders: ChildFolder[] = [];
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const dirName = entry.name;
            const fullPath = path.join(categoryPath, dirName);
            folders.push({ name: dirName, path: fullPath });
        }
    }
    return folders;
}

async function createChildFolder(categoryPath: string, requestedName: string): Promise<ChildFolder> {
    const baseName = requestedName.trim() || 'New Folder';
    let candidate = baseName;
    let suffix = 2;
    while (existsSync(path.join(categoryPath, candidate))) {
        candidate = `${baseName} (${suffix})`;
        suffix += 1;
    }
    const full = path.join(categoryPath, candidate);
    await fs.mkdir(full, { recursive: true });
    return { name: candidate, path: full };
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
    ipcMain.handle('projects:children:list', async (_event, categoryPath: string) => {
        return listChildFolders(categoryPath);
    });
    ipcMain.handle('projects:children:create', async (_event, categoryPath: string, name: string) => {
        return createChildFolder(categoryPath, name);
    });
});