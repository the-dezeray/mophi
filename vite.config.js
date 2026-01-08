import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three-globe')) {
              return 'three-globe';
            }
            if (id.includes('three')) {
              return 'three';
            }
            return 'vendor';
          }
        }
      }
    }
  }
})
