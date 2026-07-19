import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: '/'  → obligatorio para que cada página tenga su propia dirección
// (/hombre, /producto/…): así los archivos siempre se cargan desde la raíz.
export default defineConfig({
  base: '/',
  plugins: [react()],
})
