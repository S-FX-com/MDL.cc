import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'node:child_process';

// Version string follows the date of the last commit on this build —
// format YYYY.MM.DD.HHMM in UTC. Falls back to the current build time if
// the repo isn't a git checkout (ephemeral CI environments).
function buildVersion(): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const format = (d: Date) =>
    `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}.${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
  try {
    const sec = parseInt(execSync('git log -1 --format=%ct', { encoding: 'utf-8' }).trim(), 10);
    if (Number.isFinite(sec) && sec > 0) return format(new Date(sec * 1000));
  } catch { /* fall through */ }
  return format(new Date());
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion()),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
