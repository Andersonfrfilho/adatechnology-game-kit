import { describe, expect, it } from 'vitest'
import type * as THREE_NS from 'three'
import type { DestructibleSpec } from '@adatechnology/game-destruction'
import type { TestRoomItem } from '../src'
import { buildFromSpec } from '../src/build-from-spec'
import { demoItems } from './fixtures/demo-items'
import { makeRoom } from './helpers'

const GRAVITY = 9.81

/** A 2 kg shovel: a 0.9 m ash handle (0.9 kg) and a 0.3 m steel blade (1.1 kg), lying flat along x. */
const SHOVEL_SPEC = (): DestructibleSpec => ({
  name: 'Shovel',
  parts: [
    { id: 'handle', material: 'wood_hard', shape: { kind: 'box', size: [0.9, 0.035, 0.035] }, position: [-0.101, 0.053, 0], mass: 0.9, tags: ['handle'] },
    { id: 'blade', material: 'steel', shape: { kind: 'box', size: [0.301, 0.012, 0.22] }, position: [0.4005, 0.006, 0], mass: 1.1, thickness: 0.002, tags: ['blade'] },
  ],
})
const shovel: TestRoomItem = { id: 'item_shovel', name: 'Shovel', group: 'Items', build: (T: typeof THREE_NS) => buildFromSpec(T, SHOVEL_SPEC()), spec: SHOVEL_SPEC, movable: true }

describe('a hand grenade going off 0.8 m from a 2 kg shovel lying on the floor', () => {
  it.each([
    ['end on', [0.8, 0.05, 0], false],
    ['broadside', [0, 0.05, 0.8], true],
  ] as const)('%s: throws it at single-digit speed, slows its rise by gravity, and it lands and rests within a few metres', (_side, offset, hops) => {
    const room = makeRoom({ catalog: demoItems('en', [shovel]) })
    const { root, objectId } = room.spawn('item_shovel', [0, 0, -3], 0)
    room.update(0.5)
    const start = root.position.clone()
    expect(room.blastAt('m67', [start.x + offset[0], offset[1], start.z + offset[2]])).toBe(true)
    const piece = room.renderer.piece(objectId)!
    expect(piece.mass).toBeCloseTo(2, 1)
    const dt = 1 / 120
    room.update(dt)
    const launch = Math.hypot(...(piece.velocity as [number, number, number]))
    expect(launch).toBeGreaterThan(1)
    expect(launch).toBeLessThan(10)
    // while it is in the air its vertical speed falls by g each second
    const samples: Array<{ t: number; vy: number }> = []
    let landedAt = Infinity
    let hasPeaked = false
    for (let i = 1; i <= 1000; i++) {
      room.update(dt)
      const t = i * dt
      if (!hasPeaked && piece.velocity[1] > 0 && root.position.y > start.y + 0.05) samples.push({ t, vy: piece.velocity[1] })
      else if (samples.length > 0) hasPeaked = true
      if (landedAt === Infinity && t > 0.1 && root.position.y <= start.y + 0.03) landedAt = t
    }
    if (hops) {
      expect(samples.length).toBeGreaterThan(3)
      const first = samples[0]!
      const last = samples[samples.length - 1]!
      expect((first.vy - last.vy) / (last.t - first.t)).toBeCloseTo(GRAVITY, 0)
    }
    expect(landedAt).toBeLessThan(4)
    expect(Math.hypot(piece.velocity[0], piece.velocity[1], piece.velocity[2])).toBeLessThan(0.1)
    expect(Math.hypot(root.position.x - start.x, root.position.z - start.z)).toBeLessThan(10)
    expect(root.position.y).toBeLessThan(start.y + 0.3)
  })
})
