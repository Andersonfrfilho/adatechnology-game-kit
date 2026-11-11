import type { DestructibleSpec, PartSpec } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { createDestruction } from '../src'

const box = (id: string, size: [number, number, number], position: [number, number, number], extra: Partial<PartSpec> = {}): PartSpec => ({
  id, material: 'concrete', shape: { kind: 'box', size }, position, structure: { role: extra.anchored ? 'foundation' : size[1] > 1 ? 'column' : 'beam' }, ...extra,
})

/** Three pillars, a main beam on two of them and a secondary beam framing into it, laid one way (`a_on_b`). */
function frame(loadSharing?: 'nearest' | 'all'): DestructibleSpec {
  return {
    parts: [
      box('ground', [10, 0.2, 10], [0, -0.1, 0], { anchored: true }),
      box('p1', [0.2, 2.8, 0.2], [-2, 1.4, 0]), box('p2', [0.2, 2.8, 0.2], [2, 1.4, -2]), box('p3', [0.2, 2.8, 0.2], [2, 1.4, 2]),
      box('main', [0.2, 0.4, 4.2], [2, 3, 0]), box('secondary', [4, 0.4, 0.2], [0, 3, 0]),
    ],
    joints: [
      ...['p1', 'p2', 'p3'].map((p) => ({ id: `${p}~ground`, a: p, b: 'ground', kind: 'rebar' as const, bears: 'a_on_b' as const })),
      { id: 'main~p2', a: 'main', b: 'p2', kind: 'rebar', bears: 'a_on_b' }, { id: 'main~p3', a: 'main', b: 'p3', kind: 'rebar', bears: 'a_on_b' },
      { id: 'secondary~p1', a: 'secondary', b: 'p1', kind: 'rebar', bears: 'a_on_b' }, { id: 'secondary~main', a: 'secondary', b: 'main', kind: 'rebar', bears: 'a_on_b' },
    ],
    ...(loadSharing ? { loadSharing } : {}),
  }
}

describe('load sharing: the world carries a part on the supports the load path rule (game-load-path) gives it', () => {
  it("with 'all' a beam framing into another rests on it: the main beam takes half of the secondary's load", () => {
    const world = createDestruction({ seed: 1 })
    const parts = world.state(world.add(frame('all')))!.parts
    const load = (id: string): number => parts.find((p) => p.id === id)!.load!
    const mass = (id: string): number => parts.find((p) => p.id === id)!.mass
    expect(load('main')).toBeCloseTo(mass('main') + mass('secondary') / 2, 3)
    expect(load('p1')).toBeCloseTo(mass('p1') + mass('secondary') / 2, 3)
  })

  it("by default (the nearest support only) the secondary beam hangs on its pillar alone", () => {
    const world = createDestruction({ seed: 1 })
    const parts = world.state(world.add(frame()))!.parts
    const load = (id: string): number => parts.find((p) => p.id === id)!.load!
    const mass = (id: string): number => parts.find((p) => p.id === id)!.mass
    expect(load('main')).toBeCloseTo(mass('main'), 3)
    expect(load('p1')).toBeCloseTo(mass('p1') + mass('secondary'), 3)
  })
})
