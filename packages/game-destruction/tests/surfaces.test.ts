import { MATERIAL_SURFACES, SURFACE_IDS } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { MATERIALS } from '../src'

describe('every material sounds like a surface underfoot', () => {
  it('has a footstep surface for each built-in material (a new material needs its line in MATERIAL_SURFACES of game-contracts)', () => {
    for (const material of MATERIALS) expect(MATERIAL_SURFACES[material.id], material.id).toBeDefined()
    for (const surface of Object.values(MATERIAL_SURFACES)) expect(SURFACE_IDS).toContain(surface)
  })
})
