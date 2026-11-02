/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { postsPlugin } from './vite-plugin-posts';

export default defineConfig({
  plugins: [react(), postsPlugin()],
  base: '/',
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
