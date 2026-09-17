import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'rt',
          environment: 'node',
          include: ['tests/engine/rt/**/*.test.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'app',
          environment: 'jsdom',
          include: ['tests/**/*.test.{ts,tsx}'],
          exclude: ['**/node_modules/**', 'tests/engine/rt/**'],
        },
      },
    ],
  },
})
