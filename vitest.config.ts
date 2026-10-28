import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Each package defines its own environment in its vitest.config.ts.
    projects: ['packages/*', 'apps/playground'],
  },
})
