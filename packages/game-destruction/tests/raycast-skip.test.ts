import { describe, expect, it } from 'vitest'

import { createDestruction } from '../src'
import type { DestructibleSpec, DestructionWorld, Vec3 } from '../src'

/** Two boards one behind the other along z, clipped together: open the clip and split, and the back board is a loose piece. */
const boards = (): DestructibleSpec => ({
  name: 'boards',
  parts: [
    { id: 'front', material: 'wood_soft', shape: { kind: 'box', size: [1.2, 1, 0.04] }, position: [0, 0, 0.3] },
    { id: 'back', material: 'wood_soft', shape: { kind: 'box', size: [1.2, 1, 0.04] }, position: [0, 0, -0.3] },
  ],
  joints: [{ id: 'clip', a: 'front', b: 'back', kind: 'clip' }],
})

const can = (): DestructibleSpec => ({ name: 'can', parts: [{ id: 'body', material: 'aluminium', shape: { kind: 'box', size: [0.066, 0.12, 0.066] }, position: [0, 0, 0] }] })

const DOWN_Z: Vec3 = [0, 0, -1]

function splitBoards(world: DestructionWorld, at: Vec3): { readonly whole: string; readonly loose: string } {
  const whole = world.add(boards(), { position: at })
  world.disassemble(whole, 'clip', 'hand', 10)
  const group = world.state(whole)?.groups.findIndex((names) => names.includes('back')) ?? -1
  return { whole, loose: world.splitGroup(whole, group) }
}

describe('world.raycast options', () => {
  it('by default sees every piece, the loose ones too', () => {
    const world = createDestruction()
    const { whole, loose } = splitBoards(world, [0, 1, 0])
    expect(world.raycast([0, 1, 5], DOWN_Z)?.object).toBe(whole)
    expect(world.raycast([0, 1, 0], DOWN_Z)?.object).toBe(loose)
  })

  it('skipLoose leaves out the pieces splitGroup cut off and still sees what they came off', () => {
    const world = createDestruction()
    const { whole } = splitBoards(world, [0, 1, 0])
    expect(world.raycast([0, 1, 5], DOWN_Z, Infinity, { skipLoose: true })?.object).toBe(whole)
    expect(world.raycast([0, 1, 0], DOWN_Z, Infinity, { skipLoose: true })).toBeNull()
  })

  it('a loose piece stays loose through a save and a load', () => {
    const world = createDestruction()
    splitBoards(world, [0, 1, 0])
    const again = createDestruction()
    again.load(world.serialize())
    expect(again.raycast([0, 1, 0], DOWN_Z, Infinity, { skipLoose: true })).toBeNull()
    expect(again.raycast([0, 1, 0], DOWN_Z)).not.toBeNull()
  })

  it('minObjectRadius leaves out a small object and keeps a large one, with the same hit as without the small one', () => {
    const world = createDestruction()
    const small = world.add(can(), { position: [0, 1, -2] })
    const wall = world.add(boards(), { position: [0, 1, -6] })
    expect(world.raycast([0, 1, 0], DOWN_Z)?.object).toBe(small)
    const past = world.raycast([0, 1, 0], DOWN_Z, Infinity, { minObjectRadius: 0.25 })
    expect(past?.object).toBe(wall)
    expect(past?.part).toBe(world.raycast([0, 1, -3], DOWN_Z)?.part)
    expect(past?.distance).toBeCloseTo(6 - 0.3 - 0.02, 6)
  })
})
