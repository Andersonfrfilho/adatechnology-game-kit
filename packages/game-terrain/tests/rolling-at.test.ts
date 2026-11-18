import { describe, expect, it } from 'vitest'

import { createTerrain } from '../src'

describe('Terrain.rollingAt', () => {
  it('is the rolling resistance of the material columnAt reads, on a lawn, a road and sand, dug in the middle', () => {
    for (const surface of ['lawn', 'road', 'sand']) {
      const terrain = createTerrain({ bounds: [-5, -5, 5, 5], cellSize: 0.1, layout: { surface } })
      for (let k = 0; k < 4; k++) terrain.dig({ x: 0, z: 0, depth: 0.1 })
      for (let x = -1; x <= 1 + 1e-9; x += 0.05) {
        for (let z = -1; z <= 1 + 1e-9; z += 0.05) expect(terrain.rollingAt(x, z), `${surface} ${x} ${z}`).toBe(terrain.material(terrain.columnAt(x, z).material).rolling)
      }
    }
  })

  it('reads the exposed layer: a lawn is turf, a hole dug in it the soil under the turf', () => {
    const terrain = createTerrain({ bounds: [-5, -5, 5, 5], cellSize: 0.1, layout: { surface: 'lawn' } })
    expect(terrain.rollingAt(2, 2)).toBe(0.15)
    for (let k = 0; k < 2; k++) terrain.dig({ x: 0, z: 0, depth: 0.1 })
    expect(terrain.columnAt(0, 0).material).toBe('soil')
    expect(terrain.rollingAt(0, 0)).toBe(0.08)
  })
})
