import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      manifest: {
        name: 'MZM',
        short_name: 'MZM',
        description: 'Chat system for developer',
        start_url: '/',
        display: 'standalone',
        theme_color: '#222429',
        background_color: '#222429',
        icons: [
          {
            src: '/mzm.png',
            type: 'image/png',
            sizes: '144x144'
          }
        ]
      },
      workbox: {
        navigateFallbackDenylist: [/\/api/, /\/auth/, /\/socket/],
        runtimeCaching: [
          {
            urlPattern: /\/api/,
            handler: 'NetworkOnly'
          },
          {
            urlPattern: /\/auth/,
            handler: 'NetworkOnly'
          },
          {
            urlPattern: /\/socket/,
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ],
  build: {
    emptyOutDir: true,
    sourcemap: true,
    outDir: path.resolve(__dirname, 'dist')
  },
  root: path.resolve(__dirname, 'src'),
  server: {
    port: 8080,
    host: '0.0.0.0'
  },
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, '**/dist/**']
  }
})
