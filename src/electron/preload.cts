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
    },
  },
})


