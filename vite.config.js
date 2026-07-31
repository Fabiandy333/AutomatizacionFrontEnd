import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_API_BASE_URL || 'http://localhost:3000'

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5500,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
        '/socket.io': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },
  }
})
