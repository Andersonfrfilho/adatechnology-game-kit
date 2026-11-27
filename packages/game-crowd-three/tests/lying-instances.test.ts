import { undeadCrowdPack } from '@adatechnology/game-characters-undead'
import type { Corpse, CrowdPack } from '@adatechnology/game-crowd'
import { describe, expect, it } from 'vitest'

import { createCrowdInstances } from '../src'
import type { CrowdInstance, LyingBodies } from '../src'

/** Spec 008, T5.4b: the instance channel (feet position, height and a quaternion) of the bodies the engine lays on the ground. */
const pack = undeadCrowdPack() as unknown as CrowdPack
const eyes = pack.types.map((type) => type.eye ?? null)
const sizes = Array.from({ length: 20 }, () => ({ s: 1.8, bulk: 1 }))
const frame = { camera: { x: 0, z: 0 }, viewYaw: 0, target: { x: 0, z: 0, alive: true } }
const ANCHOR = [0, 1.25, 0] as const
const corpse = (variant: number): Corpse => ({ x: 1, z: 2, yaw: 0.4, height: 1.8, build: 1, named: 0, missing: 0, color: 0x445566, variant, skin: 0, seed: 3 })

const turn = (q: readonly number[], v: readonly number[]): number[] => {
  const [x, y, z, w] = q as [number, number, number, number]
  const tx = 2 * (y * v[2]! - z * v[1]!)
  const ty = 2 * (z * v[0]! - x * v[2]!)
  const tz = 2 * (x * v[1]! - y * v[0]!)
  return [v[0]! + w * tx + y * tz - z * ty, v[1]! + w * ty + z * tx - x * tz, v[2]! + w * tz + x * ty - y * tx]
}

const draw = (entries: Parameters<ReturnType<typeof createCrowdInstances>['corpses']>[0], lying?: LyingBodies) => {
  const agents: { v: number; l: number; i: CrowdInstance }[] = []
  const plain: CrowdInstance[] = []
  createCrowdInstances({ eyes }).corpses(entries, sizes, { ...frame, ...(lying ? { lying } : {}) }, 900, (v, l, i) => agents.push({ v, l, i }), (i) => plain.push(i))
  return { agents, plain }
}

describe('the bodies on the ground the engine holds (T5.4b)', () => {
  const quarterTurn = Math.SQRT1_2
  // lying on its side: turned a quarter about +z, the torso 0.2 m up at (1.5, 0.2, 2)
  const lying: LyingBodies = { torso: (id, out) => (id === 7 ? (out.set([1.5, 0.2, 2, 0, 0, quarterTurn, quarterTurn]), true) : false), anchor: () => ANCHOR }

  it('puts the feet where the turned torso anchor lands on the torso the engine has, and carries the quaternion', () => {
    const { agents } = draw([{ id: 7, age: 1, data: corpse(0) }], lying)
    expect(agents).toHaveLength(1)
    const instance = agents[0]!.i
    expect(instance.rotation).toEqual([0, 0, quarterTurn, quarterTurn])
    const feet = [instance.a[0], instance.y, instance.a[1]]
    const anchor = turn(instance.rotation!, ANCHOR)
    expect([feet[0]! + anchor[0]!, feet[1]! + anchor[1]!, feet[2]! + anchor[2]!]).toEqual([expect.closeTo(1.5, 6), expect.closeTo(0.2, 6), expect.closeTo(2, 6)])
  })

  it('draws a body of a civilian (no variant) on the plain batch, turned the same way', () => {
    const { agents, plain } = draw([{ id: 7, age: 1, data: corpse(-1) }], lying)
    expect(agents).toHaveLength(0)
    expect(plain).toHaveLength(1)
    expect(plain[0]!.rotation).toEqual([0, 0, quarterTurn, quarterTurn])
  })

  it('leaves a corpse the engine does not hold to its lying pose, and every corpse when the host has no engine', () => {
    const held = draw([{ id: 8, age: 1, data: corpse(0) }], lying)
    expect(held.agents[0]!.i.rotation).toBeUndefined()
    expect(held.agents[0]!.i.y).toBe(0)
    const none = draw([{ id: 7, age: 1, data: corpse(0) }])
    expect(none.agents[0]!.i.rotation).toBeUndefined()
    expect(none.agents[0]!.i.a[0]).toBe(1)
  })
})
