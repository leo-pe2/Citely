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
      };
    };
  }
}

