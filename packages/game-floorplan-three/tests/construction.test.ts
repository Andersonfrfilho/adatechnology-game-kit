import { validateStructure } from '@adatechnology/game-floorplan-structure'
import { describe, expect, it } from 'vitest'

import { wallPlan } from '../src/wall'

/** The free-standing walls of the scenes: the room's target wall (10 x 3 m), the sound check wall (4 x 2.6 m), a short garden wall and a long one. */
const WALLS = [
  { w: 10, h: 3 },
  { w: 4, h: 2.6 },
  { w: 1.2, h: 1.8 },
  { w: 23, h: 2.2, finish: 'exposed_block' },
]

/** Construction tests (CLAUDE.md §11): `wallPiece` builds every wall of the kit as the houses' walls, on its ground beam, with pillars from the floor to the bond beam. */
describe('wallPiece construction', () => {
  for (const options of WALLS) {
    it(`${options.w} x ${options.h} m${options.finish ? ` ${options.finish}` : ''}: confined masonry`, () => {
      const structure = wallPlan(options).structure
      expect(validateStructure(structure, { wallDetail: 'coarse' })).toEqual([])
      expect(validateStructure(structure)).toEqual([])
      const pillars = structure.parts.filter((p: { role: string }) => p.role === 'column')
      expect(pillars.length).toBeGreaterThanOrEqual(2)
      expect(structure.parts.some((p: { beamKind?: string }) => p.beamKind === 'ground_beam')).toBe(true)
    })
  }
})
