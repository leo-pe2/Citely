import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    base: './',
    build: {
      outDir: 'dist-react',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src/ui'),
        '@features': path.resolve(__dirname, './src/ui/features'),
      },
    },
    server: {
      port: 5123,
      strictPort: true,
    },
  });
