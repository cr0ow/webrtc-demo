import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    https: {
      cert: './cert/cert.pem',
      key: './cert/key.pem'
    }
  }
})
