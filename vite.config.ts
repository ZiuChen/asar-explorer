import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

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
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      manifest: {
        name: 'ASAR Explorer',
        short_name: 'ASAR Explorer',
        description: 'Preview and edit Electron ASAR files online',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/logo.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})
