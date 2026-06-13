import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' => la carpeta dist funciona en cualquier ruta / hosting
export default defineConfig({
  base: './',
  plugins: [react()],
})
