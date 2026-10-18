import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Rutas relativas: la app se publica en una subcarpeta
  // (luisortizx31-cyber.github.io/barbero/), no en la raíz.
  base: './',
  plugins: [react(), tailwindcss()],
})
