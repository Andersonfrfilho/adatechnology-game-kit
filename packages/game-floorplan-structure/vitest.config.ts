import { defineConfig } from 'vitest/config'

// Forks: the golden loops keep a worker busy for seconds, and a threaded worker missed its heartbeat. The two VC3 golden files run in their own
// workers (in one fork the 170 s run timed out calling onTaskUpdate), and CI shards the package (`SHARDS` in .github/workflows/ci.yml).
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 120000, pool: 'forks' },
})
