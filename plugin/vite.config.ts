import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';

// 自定义插件：将 JS 和 CSS 内联到 HTML
function inlinePlugin() {
  return {
    name: 'inline-plugin',
    closeBundle() {
      const distPath = resolve(__dirname, 'dist');
      const htmlPath = resolve(distPath, 'index.html');
      const jsPath = resolve(distPath, 'ui.js');

      let html = readFileSync(htmlPath, 'utf-8');
      const js = readFileSync(jsPath, 'utf-8');

      // 移除所有 script 标签
      html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

      // 在 </body> 前添加内联脚本
      html = html.replace('</body>', `<script>${js}</script></body>`);

      // 写入 ui.html（Figma 需要的文件名）
      writeFileSync(resolve(distPath, 'ui.html'), html);
      console.log('Created ui.html with inlined JavaScript');
    },
  };
}

export default defineConfig({
  plugins: [react(), inlinePlugin()],
  build: {
    outDir: 'dist',
    target: 'es2015', // 更好的兼容性
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        entryFileNames: 'ui.js',
        assetFileNames: 'ui.[ext]',
        manualChunks: undefined,
        // 避免使用现代语法
        generatedCode: {
          arrowFunctions: false,
          constBindings: false,
          objectShorthand: false,
        },
      },
    },
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    minify: 'terser',
    terserOptions: {
      ecma: 5,
      compress: {
        arrows: false,
      },
      format: {
        ecma: 5,
      },
    },
  },
});
