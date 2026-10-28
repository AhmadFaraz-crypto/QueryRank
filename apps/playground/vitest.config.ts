import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'playground',
    // The suites here cover pure logic (CSV import + chart-data engine), so a
    // plain Node environment is enough — no DOM needed.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
