import { describe, expect, it } from 'vitest'
import type { DestructibleSpec } from '@adatechnology/game-destruction'

import type { TestRoom } from '../src'
import { makeRoom } from './helpers'

const DRUM_AT: [number, number, number] = [0, 0, -3]
/** A steel drum of petrol standing on the floor: the body holds the liquid, the lid none. */
const drum: DestructibleSpec = {
  name: 'drum',
  parts: [
    { id: 'body', material: 'steel', mass: 20, shape: { kind: 'box', size: [0.58, 0.85, 0.58] }, position: [0, 0.425, 0], anchored: true, fill: 0.03, thickness: 0.001, contains: { fluid: 'fuel', liters: 60 } },
    { id: 'lid', material: 'steel', mass: 2, shape: { kind: 'box', size: [0.58, 0.02, 0.58] }, position: [0, 0.86, 0] },
  ],
  joints: [{ a: 'lid', b: 'body', kind: 'weld' }],
}

const run = (room: TestRoom, seconds: number): void => {
  for (let t = 0; t < seconds; t += 1 / 60) room.update(1 / 60)
}
const fuelOnFloor = (room: TestRoom) => room.fluids.stains().filter((s) => s.liquid === 'fuel')
const leftIn = (room: TestRoom): number => room.world.part('drum', 'body')!.liters!

describe('a part that holds a liquid leaks it out of the hole onto the floor', () => {
  it('one bullet low in a drum of petrol: the petrol comes out of the hole and the stain under it grows with what came out', () => {
    const room = makeRoom({ scenery: { shelf: null, table: null, drum: { spec: drum, position: DRUM_AT } } })
    run(room, 0.5)
    room.world.hitPart('drum', 'body', { type: 'ballistic', point: [0, 0.2, DRUM_AT[2] + 0.29], direction: [0, 0, -1], energy: 500, caliber: 9 })
    run(room, 1)
    const early = fuelOnFloor(room)
    expect(early.length).toBeGreaterThan(0)
    // it lies on the floor, near the hole, not at the height of the hole
    for (const s of early) {
      expect(s.center[1]).toBeLessThan(0.02)
      expect(Math.hypot(s.center[0] - DRUM_AT[0], s.center[2] - (DRUM_AT[2] + 0.29))).toBeLessThan(0.6)
    }
    const area = (room2: TestRoom): number => fuelOnFloor(room2).reduce((sum, s) => sum + Math.PI * (s.front.reduce((a, r) => a + r, 0) / s.front.length) ** 2, 0)
    const firstArea = area(room)
    const out1 = 60 - leftIn(room)
    run(room, 4)
    const out2 = 60 - leftIn(room)
    // it went on leaking, and the stain grew with it: a few litres a minute, not a 2 m pool at once
    expect(out2).toBeGreaterThan(out1)
    expect(area(room)).toBeGreaterThan(firstArea)
    expect(firstArea).toBeLessThan(1)
  })

  it('a shot that misses the liquid part leaks nothing', () => {
    const room = makeRoom({ scenery: { shelf: null, table: null, drum: { spec: drum, position: DRUM_AT } } })
    run(room, 0.5)
    room.world.hitPart('drum', 'lid', { type: 'ballistic', point: [0, 0.86, DRUM_AT[2] + 0.29], direction: [0, 0, -1], energy: 500, caliber: 9 })
    run(room, 3)
    expect(fuelOnFloor(room)).toHaveLength(0)
  })
})
