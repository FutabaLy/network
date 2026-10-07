import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

/**
 * 网页实时版（Remotion Player）构建配置。
 * 默认是居中卡片布局，?full=1 铺满视口，?ui=1 打开调试界面。
 */
export default defineConfig({
  base: './',
  publicDir: 'web-public',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
  },
});
