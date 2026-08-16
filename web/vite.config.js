import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from '@vant/auto-import-resolver'
import path from 'path'

export default defineConfig({
  plugins: [vue(), Components({ resolvers: [VantResolver()] })],
  // 构建产物输出到项目根目录 dist/（部署时直接用，跟着 github 传）
  build: {
    outDir: path.resolve(__dirname, '../dist'),
    emptyOutDir: true,
  },
  server: {
    port: 55080,
    strictPort: true,
    host: '127.0.0.1',
    // 代理后端 API（开发期跨域）
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
})
