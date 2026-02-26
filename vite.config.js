import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: [
      '8aa5517f-32fa-4544-8d77-cf52d7282a0e-00-i6pkwo9osn90.riker.replit.dev'
    ]
  }
})