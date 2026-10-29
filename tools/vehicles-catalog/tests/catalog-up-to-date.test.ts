import { describe, expect, it } from 'vitest'

import { buildCatalog, buildGameSlice, staleFiles } from '../src/build'

describe('generated catalog', () => {
  it('matches what the team sources generate now (run `pnpm --filter @adatechnology/vehicles-catalog-tool catalog`)', () => {
    expect(staleFiles(buildCatalog())).toEqual([])
  })

  it('has the game slice up to date (run `pnpm --filter @adatechnology/vehicles-catalog-tool catalog:game`)', () => {
    expect(staleFiles(buildGameSlice())).toEqual([])
  })
})
