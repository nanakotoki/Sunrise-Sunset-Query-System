import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 单文件构建：所有 JS/CSS 内联进 dist-single/index.html，
// 可直接托管到任意静态服务器，或下载后本地打开。
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: { outDir: 'dist-single' },
});
