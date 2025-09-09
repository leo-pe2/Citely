import { contextBridge, ipcRenderer } from 'electron'

type Project = {
  id: string
  name: string
  path: string
}

contextBridge.exposeInMainWorld('api', {
  projects: {
    list: (): Promise<Project[]> => ipcRenderer.invoke('projects:list'),
    create: (name: string): Promise<Project> => ipcRenderer.invoke('projects:create', name),
    delete: (idOrPath: string): Promise<{ ok: true }> => ipcRenderer.invoke('projects:delete', idOrPath),
    items: {
      importPdf: (projectId: string): Promise<{ imported: { fileName: string; path: string }[] }> =>
        ipcRenderer.invoke('projects:item:import-pdf', projectId),
      exists: (projectId: string): Promise<{ hasItems: boolean }> =>
        ipcRenderer.invoke('projects:items:exists', projectId),
      list: (projectId: string): Promise<{ items: { fileName: string; path: string }[] }> =>
        ipcRenderer.invoke('projects:items:list', projectId),
      delete: (absolutePath: string): Promise<{ ok: true }> =>
        ipcRenderer.invoke('projects:item:delete', absolutePath),
      deleteAll: (projectId: string, pdfFileName: string, absolutePath: string): Promise<{ ok: true }> =>
        ipcRenderer.invoke('projects:item:delete-all', projectId, pdfFileName, absolutePath),
    },
    kanban: {
      get: (projectId: string): Promise<Record<string, string>> =>
        ipcRenderer.invoke('projects:kanban:get', projectId),
      set: (projectId: string, statuses: Record<string, string>): Promise<{ ok: true }> =>
        ipcRenderer.invoke('projects:kanban:set', projectId, statuses),
    },
    highlights: {
      get: (projectId: string, pdfFileName: string): Promise<unknown[]> =>
        ipcRenderer.invoke('projects:highlights:get', projectId, pdfFileName),
      set: (projectId: string, pdfFileName: string, highlights: unknown[]): Promise<{ ok: true }> =>
        ipcRenderer.invoke('projects:highlights:set', projectId, pdfFileName, highlights),
    },
  },
  files: {
    readFileBase64: (absolutePath: string): Promise<string> =>
      ipcRenderer.invoke('file:read-base64', absolutePath),
  },
})


