/// <reference types="vite/client" />

type Project = {
  id: string;
  name: string;
  path: string;
};

declare global {
  interface Window {
    api: {
      projects: {
        list: () => Promise<Project[]>;
        create: (name: string) => Promise<Project>;
        delete: (idOrPath: string) => Promise<{ ok: true }>;
        items: {
          importPdf: (projectId: string) => Promise<{ imported: { fileName: string; path: string }[] }>;
          exists: (projectId: string) => Promise<{ hasItems: boolean }>;
          list: (projectId: string) => Promise<{ items: { fileName: string; path: string }[] }>;
        };
        kanban: {
          get: (projectId: string) => Promise<Record<string, string>>;
          set: (projectId: string, statuses: Record<string, string>) => Promise<{ ok: true }>;
        };
      };
      files: {
        readFileBase64: (absolutePath: string) => Promise<string>;
      };
    };
  }
}

