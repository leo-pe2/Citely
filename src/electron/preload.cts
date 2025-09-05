import { contextBridge, ipcRenderer } from 'electron'

type Project = {
  id: string
  name: string
  path: string
}

type ChildFolder = {
  name: string
  path: string
}

contextBridge.exposeInMainWorld('api', {
  projects: {
    list: (): Promise<Project[]> => ipcRenderer.invoke('projects:list'),
    create: (name: string): Promise<Project> => ipcRenderer.invoke('projects:create', name),
    children: {
      list: (categoryPath: string): Promise<ChildFolder[]> =>
        ipcRenderer.invoke('projects:children:list', categoryPath),
      create: (categoryPath: string, name: string): Promise<ChildFolder> =>
        ipcRenderer.invoke('projects:children:create', categoryPath, name),
    },
  },
})


