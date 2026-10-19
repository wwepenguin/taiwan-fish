/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base: './' 讓建置結果可部署於 GitHub Pages 或任何子路徑
export default defineConfig({
  base: './',
  plugins: [vue()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
