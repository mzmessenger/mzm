import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, type UserConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import path from 'path'

const dirname = path.dirname(new URL(import.meta.url).pathname)

export default defineConfig(({ mode }) => {
  const API_URL_BASE =
    mode === 'production' ? 'https://api.mzm.dev' : 'http://localhost:3001'
  const AUTH_URL_BASE =
    mode === 'production' ? 'https://auth.mzm.dev' : 'http://localhost:3002'

  return {
    define: {
      __API_URL_BASE__: JSON.stringify(
        process.env.API_DOMAIN_BASE ?? API_URL_BASE
      ),
      __AUTH_URL_BASE__: JSON.stringify(
        process.env.AUTH_URL_BASE ?? AUTH_URL_BASE
      )
    },
    resolve: {
      alias: [
        { find: 'mzm-shared', replacement: path.resolve(dirname, '../shared') }
      ]
    },
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
          navigateFallbackDenylist: [/\/api/, /\/auth/],
          runtimeCaching: [
            {
              urlPattern: /\/api/,
              handler: 'NetworkOnly'
            },
            {
              urlPattern: /\/auth/,
              handler: 'NetworkOnly'
            }
          ]
        }
      })
    ],
    build: {
      emptyOutDir: true,
      sourcemap: true,
      target: 'esnext',
      outDir: path.resolve(dirname, 'dist')
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
  } satisfies UserConfig
})
