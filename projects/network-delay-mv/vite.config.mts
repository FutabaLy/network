import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

/**
 * 网页实时版（Remotion Player）构建配置。
 *
 * publicDir 指向 `public/`：这个工程的静态资源只有 `public/narration/*.mp3`（24 条中文旁白，
 * 合计约 0.5 MB），合成与网页版共用同一批文件 —— 这样网页版也有声音，且仓库里不用存两份。
 * （排序 MV 那个工程是 public/=渲染母带、web-public/=上线资源两套，需求不同所以分开。）
 *
 * base: './' → 放在 GitHub Pages 的项目子路径（/network/）也能跑。
 * 默认居中卡片布局，?full=1 铺满视口，?ui=1 打开调试界面，?frame=N 直接定位到某一帧。
 */
export default defineConfig({
  base: './',
  publicDir: 'public',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
  },
});
