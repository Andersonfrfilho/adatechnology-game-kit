import { describe, expect, it } from 'vitest'
import type { DestructibleSpec } from '@adatechnology/game-destruction'
import { buildFromSpec } from '../src'
import type { ModuleHost, TestableModule } from '@adatechnology/game-contracts'
import { makeRoom as makeBareRoom } from './helpers'
import type { TestRoomOptions } from '../src'

/** The height the room gives to the floor at (x, z): what the host of a module sees as `groundAt`. */
function roomWithGround(extra: Partial<TestRoomOptions> = {}) {
  const room = makeBareRoom(extra)
  let host: ModuleHost | undefined
  const probe: TestableModule = { id: 'probe', name: 'Probe', group: 'Probe', items: () => [], attach: (h) => { host = h; return () => undefined } }
  room.loadModule(probe)
  return { room, groundAt: (x: number, z: number): number => host!.groundAt(x, z) }
}

const crate = (): DestructibleSpec => ({
  name: 'crate',
  parts: [
    { id: 'lid', material: 'wood_soft', shape: { kind: 'box', size: [1, 0.1, 0.6] }, position: [0, 0.95, 0] },
    { id: 'body', material: 'wood_soft', shape: { kind: 'box', size: [1, 0.9, 0.6] }, position: [0, 0.45, 0], anchored: true },
  ],
  joints: [{ a: 'lid', b: 'body', kind: 'nail' }],
})

describe('scenery of the arena', () => {
  it('a bare room keeps the three default pieces, the tap and the table top', () => {
    const { room, groundAt } = roomWithGround()
    for (const id of ['target_wall', 'table', 'shelf']) expect(room.world.has(id)).toBe(true)
    expect(room.world.state('target_wall')!.parts).toHaveLength(48)
    expect(groundAt(3.5, 0)).toBeCloseTo(0.78)
    expect(groundAt(0, 0)).toBe(0)
    expect(room.fluids.taps()).toHaveLength(1)
    expect(room.fluids.taps()[0].position[0]).toBeCloseTo(3.8)
  })

  it('null removes a piece, and without the table there is no tap and no top', () => {
    const { room, groundAt } = roomWithGround({ scenery: { table: null, shelf: null } })
    expect(room.world.has('table')).toBe(false)
    expect(room.world.has('shelf')).toBe(false)
    expect(room.world.has('target_wall')).toBe(true)
    expect(groundAt(3.5, 0)).toBe(0)
    expect(room.fluids.taps()).toHaveLength(0)
  })

  it('a new key adds a piece (position required), a known key replaces the default and keeps its position', () => {
    expect(() => roomWithGround({ scenery: { crate: { spec: crate() } } })).toThrow(/needs a position/)
    const { room, groundAt } = roomWithGround({
      scenery: {
        crate: { spec: crate(), position: [0, 0, -4], rotationY: Math.PI / 2, label: 'Crate', top: { part: 'lid', y: 1 } },
        shelf: { spec: crate(), build: (T) => buildFromSpec(T, crate()) },
      },
    })
    expect(room.world.has('crate')).toBe(true)
    expect(room.world.state('shelf')!.parts.map((p) => p.id).sort()).toEqual(['body', 'lid'])
    expect(groundAt(0, -4)).toBeCloseTo(1)
    // turned a quarter: the lid is 0.6 wide along x and 1 deep along z
    expect(groundAt(0.25, -3.6)).toBeCloseTo(1)
    expect(groundAt(0.4, -4)).toBe(0)
  })

  it('the tap follows the top of the table, and the top stops holding things when its part breaks', () => {
    const { room, groundAt } = roomWithGround({ scenery: { table: { spec: crate(), position: [3.5, 0, 0], top: { part: 'lid', y: 1 } } } })
    expect(groundAt(3.5, 0)).toBeCloseTo(1)
    // the tap follows the table top: its right edge (4) plus 0.35
    expect(room.fluids.taps()[0].position[0]).toBeCloseTo(3.5 + 0.3)
    room.world.hitPart('table', 'lid', { type: 'blunt', point: [3.5, 1, 0], energy: 3e6, radius: 0.3 })
    expect(room.world.part('table', 'lid')!.status).toBe('broken')
    expect(groundAt(3.5, 0)).toBe(0)
  })
})
