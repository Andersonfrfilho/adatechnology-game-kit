import { describe, expect, it } from 'vitest'

import { buildCatalog, staleFiles } from '../src/build'
import { GAME_SLICE_DIR } from '../src/paths'

describe('generated catalog', () => {
  it('matches what the team sources and decisions.json generate now and the game slice (run `pnpm --filter @adatechnology/items-catalog-tool catalog`)', () => {
    expect(staleFiles(buildCatalog({ gameOutput: GAME_SLICE_DIR }))).toEqual([])
  })
})
