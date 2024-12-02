import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ws': {
        target: 'https://localhost:8080',
        ws: true,
        secure: false
      },
    },
    https: {
      cert: './cert/cert-front.pem',
      key: './cert/cert-front-key.pem'
    }
  }
})
