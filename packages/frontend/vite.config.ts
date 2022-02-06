import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true,
    outDir: path.resolve(__dirname, 'dist')
  },
  root: path.resolve(__dirname, 'src'),
  server: {
    port: 8080,
    host: '0.0.0.0'
  }
})
