import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  build: {
    sourcemap: true,
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            {
              name: (id) => {
                if (id.includes('node_modules')) {
                  const name = id.split('node_modules/.pnpm/')[1].split('/')[0]
                  return `vendor_${name}`
                }
              }
            }
          ]
        }
      }
    }
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
