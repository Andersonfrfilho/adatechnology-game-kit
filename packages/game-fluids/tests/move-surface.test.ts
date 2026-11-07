import { describe, expect, it } from 'vitest'
import { createFluids } from '../src'

describe('moveSurface', () => {
  it('a table pushed away carries the stain spilled on its top', () => {
    const world = createFluids({ seed: 1 })
    world.addSurface({ id: 'table', point: [0, 0.78, 0], normal: [0, 1, 0], halfSize: [0.8, 0.4], porosity: 0.3 })
    world.splash('water', [0.2, 1, 0], 0.2)
    world.update(0.2)
    const stain = world.stains().find((s) => s.surface === 'table')!
    world.moveSurface('table', [0, 0, -1.5])
    const moved = world.stains().find((s) => s.id === stain.id)!
    expect(moved.center[2]).toBeCloseTo(stain.center[2] - 1.5, 6)
    expect(moved.center[0]).toBeCloseTo(stain.center[0], 6)
    // a new splash lands on the top where it stands now
    world.splash('water', [0, 1, -1.5], 0.1)
    world.update(0.2)
    expect(world.stains().filter((s) => s.surface === 'table').length).toBeGreaterThan(0)
    world.moveSurface('nothing', [1, 0, 0])
  })
})
