import { describe, expect, it } from 'vitest'

import { createFluids } from '../src'

describe('shatter', () => {
  it('a jar that breaks on a table: its juice falls onto the top and the container is gone', () => {
    const world = createFluids({ seed: 2 })
    world.addSurface({ id: 'table', point: [0, 0.78, 0], normal: [0, 1, 0], halfSize: [0.8, 0.4], porosity: 0.3 })
    const jar = world.addContainer({ shape: { kind: 'cylinder', radius: 0.035, height: 0.09 }, opening: 0.03, capacity: 0.35, liquid: 'juice', liters: 0.3 }, { position: [0.2, 0.79, 0] })
    world.update(0.1)
    world.shatter(jar)
    world.update(0.5)
    expect(world.container(jar)).toBeNull()
    const juice = world.stains().filter((s) => s.liquid === 'juice')
    expect(juice).toHaveLength(1)
    expect(juice[0]!.surface).toBe('table')
    expect(juice[0]!.liters + juice[0]!.soaked).toBeCloseTo(0.3, 1)
    world.shatter('nothing')
  })
})
