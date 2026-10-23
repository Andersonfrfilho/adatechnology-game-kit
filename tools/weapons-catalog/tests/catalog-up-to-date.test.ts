import { describe, expect, it } from 'vitest'

import { buildCatalog, staleFiles } from '../src/build'

describe('generated catalog', () => {
  it('matches what the team sources and decisions.json generate now (run `pnpm --filter @adatechnology/weapons-catalog-tool catalog`)', () => {
    expect(staleFiles(buildCatalog())).toEqual([])
  })
})
