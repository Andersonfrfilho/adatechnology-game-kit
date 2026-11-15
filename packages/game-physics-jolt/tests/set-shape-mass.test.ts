import { describe, expect, it } from 'vitest'

import type { ShapeDesc, Vec3 } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import type { JoltWorld } from '../src/index'

const inverse = (inertia: Vec3): Vec3 => [1 / inertia[0], 1 / inertia[1], 1 / inertia[2]]

const expectSameInverseInertia = (got: Vec3, want: Vec3): void => {
  const a = inverse(got)
  const b = inverse(want)
  for (let i = 0; i < 3; i++) expect(Math.abs(a[i]! - b[i]!) / b[i]!).toBeLessThan(1e-6)
}

/** A piece made with `before`, then `setShape` to `after`, against one made directly with `after` and the same mass. */
const compare = async (before: ShapeDesc, after: ShapeDesc, mass: number, inertia?: Vec3): Promise<void> => {
  const engine = await createJoltEngine()
  const world = engine.createWorld() as JoltWorld
  const changed = world.createBody({ shape: before, motion: 'dynamic', mass, position: [0, 1, 0], user: 0 })
  world.setShape(changed, after, inertia ? { mass, inertia } : undefined)
  const direct = world.createBody({ shape: after, motion: 'dynamic', mass, ...(inertia ? { inertia } : {}), position: [2, 1, 0], user: 1 })
  const got = world.massProperties(changed)
  const want = world.massProperties(direct)
  expect(1 / got.mass).toBeCloseTo(1 / mass, 9)
  expect(got.mass).toBeCloseTo(mass, 9)
  expectSameInverseInertia(got.inertia, want.inertia)
  world.dispose()
}

describe('setShape keeps the kit mass (spec 008 bug 1)', () => {
  it('a 2 kg piece that changes shape is still 2 kg (inverse mass 0.5), its inertia the new shape scaled to 2 kg', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld() as JoltWorld
    const piece = world.createBody({ shape: { kind: 'box', half: [0.1, 0.1, 0.1] }, motion: 'dynamic', mass: 2, position: [0, 1, 0], user: 0 })
    world.setShape(piece, { kind: 'box', half: [0.3, 0.05, 0.1] }, undefined)
    expect(1 / world.massProperties(piece).mass).toBeCloseTo(0.5, 9)
    world.dispose()
    await compare({ kind: 'box', half: [0.1, 0.1, 0.1] }, { kind: 'box', half: [0.3, 0.05, 0.1] }, 2)
  })

  it('a 5 g chip of 1.5 cm (moments under 1e-6 kg m^2) keeps 5 g and the new shape\'s own inertia, not a 1 m sphere\'s', async () => {
    await compare({ kind: 'box', half: [0.0075, 0.0075, 0.0075] }, { kind: 'box', half: [0.0075, 0.002, 0.005] }, 0.005)
  })

  it('the moments given to setShape are the ones kept', async () => {
    await compare({ kind: 'box', half: [0.1, 0.1, 0.1] }, { kind: 'box', half: [0.3, 0.05, 0.1] }, 2, [0.01, 0.02, 0.03])
    await compare({ kind: 'box', half: [0.0075, 0.0075, 0.0075] }, { kind: 'box', half: [0.0075, 0.002, 0.005] }, 0.005, [3e-8, 5e-8, 4e-8])
  })
})
