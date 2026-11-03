import { residentialItems } from '@adatechnology/game-floorplan-residential'
import { describe, expect, it } from 'vitest'

import { defaultFurnitureCatalog } from '../src'

describe('defaultFurnitureCatalog', () => {
  it('is the residential catalogue with a size for a bookcase', () => {
    expect(defaultFurnitureCatalog()).toBe(residentialItems)
    expect(defaultFurnitureCatalog().find((entry) => entry.type === 'bookcase')?.h).toBeGreaterThan(0)
  })
})
