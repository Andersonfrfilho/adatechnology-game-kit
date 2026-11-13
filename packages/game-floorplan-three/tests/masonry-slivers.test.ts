import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import type { StructurePart } from '@adatechnology/game-floorplan-structure'

import { buildMasonryPanel, createMasonryBatches } from '../src/construction-stages/masonry-stage'

describe('masonry between two cuts: a sliver too narrow for a unit is filled with mortar, never left open', () => {
  it('a 1.5 cm gap between two pillars standing in a wall is mortar from the floor to the top', () => {
    const wall = { id: 'wall_0_0', role: 'wall', material: 'brick', assembly: 'brick_wall_plastered', aabb: [0, -0.085, 3, 0.085], y0: 0, y1: 2.6, floor: 0, mass: 1 } as unknown as StructurePart
    // a pillar to 1.2 m along the wall, another from 1.215 m: 1.5 cm of wall between them
    const cuts = [{ a0: 0.9, a1: 1.2, y0: 0, y1: 2.6 }, { a0: 1.215, a1: 1.515, y0: 0, y1: 2.6 }]
    const batches = createMasonryBatches()
    buildMasonryPanel(batches, wall, { cuts, courseBase: 0 })
    const mortar = batches.mortar.mesh(THREE, new THREE.MeshBasicMaterial(), 'mortar')
    expect(mortar).not.toBeNull()
    const position = mortar!.geometry.getAttribute('position')
    // some mortar box lies in the sliver, from near the floor to near the top
    let lo = Infinity, hi = -Infinity
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i)
      if (x > 1.2 && x < 1.215) { lo = Math.min(lo, position.getY(i)); hi = Math.max(hi, position.getY(i)) }
    }
    expect(lo).toBeLessThan(0.01)
    expect(hi).toBeGreaterThan(2.59)
  })
})
