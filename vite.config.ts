import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  build: {
    sourcemap: true
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // 告诉 Vue monaco-editor 是自定义元素
          isCustomElement: (tag) => tag === 'monaco-editor'
        }
      }
    }),
    tailwindcss()
  ]
})
