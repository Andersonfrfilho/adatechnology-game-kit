import { describe, expect, it } from 'vitest'
import { explosivePart } from '@adatechnology/game-destruction'
import type { DestructibleSpec } from '@adatechnology/game-destruction'
import type { HostEvent } from '@adatechnology/game-contracts'
import { makeRoom } from './helpers'
import type { TestRoom } from '../src'

const run = (room: TestRoom, seconds: number): void => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) room.update(1 / 60)
}

const explosionsOf = (room: TestRoom): HostEvent[] => {
  const events: HostEvent[] = []
  room.loadModule({
    id: 'spy',
    name: 'spy',
    group: 'spy',
    items: () => [],
    attach: (host) => host.on((event) => event.type === 'explosion' && events.push(event)),
  })
  return events
}

const equip = (room: TestRoom, weapon: string): void => {
  room.setTool(weapon)
  run(room, 0.5)
}

/** One mesh of the given size lying on the floor, so the object has a box of its own. */
const meshOf = (THREE: typeof import('three'), size: [number, number, number]): import('three').Group => {
  const group = new THREE.Group()
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]))
  mesh.position.y = size[1] / 2
  group.add(mesh)
  return group
}

const barrel = (room: TestRoom, x: number): string => {
  const def = room.arsenal.explosives.get('fuel_barrel')
  if (!def) throw new Error('no fuel_barrel')
  const spec: DestructibleSpec = {
    name: 'Barrel',
    parts: [explosivePart(def, { id: 'tank', material: 'steel', shape: { kind: 'cylinder', radius: 0.3, height: 0.9 }, position: [0, 0.45, 0], thickness: 0.001, fill: 0.03 })],
    joints: [],
  }
  room.loadModule({ id: `barrels_${x}`, name: 'b', group: 'b', items: () => [{ id: `barrel_${x}`, name: 'Barrel', build: (THREE) => new (THREE as typeof import('three')).Group(), spec }] })
  return room.spawn(`barrel_${x}`, [x, 0, -8]).objectId
}

describe('explosives of the room go through the rule of game-weapons', () => {
  it('a grenade flies, waits for its fuse and tells the module where it blew', () => {
    const room = makeRoom()
    const explosions = explosionsOf(room)
    equip(room, 'frag_grenade')
    room.look([0, 1.7, 5], [0, 0.6, -3])
    room.use()
    run(room, 1)
    expect(explosions).toHaveLength(0)
    run(room, 5)
    expect(explosions).toMatchObject([{ type: 'explosion', cause: 'timer', energy: 200000 }])
    expect(room.log.entries({ type: 'explode' })).toHaveLength(1)
  })

  it('a rocket that hits before its arming distance is a dud, and one that flies far enough explodes on impact', () => {
    const room = makeRoom()
    const explosions = explosionsOf(room)
    equip(room, 'm72_law')
    room.look([0, 1.7, 5], [0, 1.7, 0])
    room.spawn('chair', [0, 0, 1])
    room.look([0, 1.7, 5], [0, 0.4, 1])
    room.use()
    run(room, 1)
    expect(room.log.entries({ type: 'dud' })).toHaveLength(1)
    expect(explosions).toHaveLength(0)
    room.tool.refill()
    run(room, 1)
    room.look([0, 1.7, 5], [0, 1.7, -30])
    room.use()
    run(room, 3)
    expect(explosions).toMatchObject([{ cause: 'impact' }])
    expect(room.log.entries({ type: 'backblast' })).toHaveLength(2)
  })

  it('a charge set down waits for the detonator (Y) and only reaches what is in front of its cone', () => {
    const room = makeRoom()
    const explosions = explosionsOf(room)
    const ahead = room.spawn('chair', [0, 0, -2]).objectId
    const behind = room.spawn('chair', [0, 0, 9]).objectId
    equip(room, 'claymore')
    room.look([0, 1.7, 5], [0, 0.2, 1])
    room.use()
    run(room, 5)
    expect(room.log.entries({ type: 'place_charge' })).toHaveLength(1)
    expect(explosions).toHaveLength(0)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyY' }))
    run(room, 0.2)
    expect(explosions).toMatchObject([{ type: 'explosion', cause: 'wire' }])
    expect(room.world.state(ahead)?.parts.some((part) => part.status !== 'intact')).toBe(true)
    expect(room.world.state(behind)?.parts.every((part) => part.status === 'intact')).toBe(true)
  })

  it('a long object reaches into the cone of a charge even when its origin lies behind it', () => {
    const room = makeRoom()
    const beam: DestructibleSpec = { name: 'Beam', parts: [{ id: 'body', material: 'wood_soft', shape: { kind: 'box', size: [0.4, 0.4, 12] }, position: [0, 0.2, 0] }], joints: [] }
    room.loadModule({ id: 'beams', name: 'b', group: 'b', items: () => [{ id: 'beam', name: 'Beam', build: (THREE) => meshOf(THREE as typeof import('three'), [0.4, 0.4, 12]), spec: beam }] })
    // the charge lands about 2 m ahead of the player (z 3), facing -z; the origin of the beam (z 6) is behind it and its near end (z 0) is 3 m ahead of it
    const spanning = room.spawn('beam', [0.5, 0, 6]).objectId
    equip(room, 'claymore')
    room.look([0, 1.7, 5], [0, 0.2, 1])
    room.use()
    run(room, 5)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyY' }))
    run(room, 0.2)
    expect(room.world.state(spanning)?.parts.some((part) => part.status !== 'intact')).toBe(true)
  })

  it('a fuel barrel set off by a blast primes the next one and it goes off after its own delay (chain reaction)', () => {
    const room = makeRoom()
    const first = barrel(room, -1)
    const second = barrel(room, 1)
    equip(room, 'frag_grenade')
    room.look([0, 1.7, 5], [-1, 0.45, -8])
    room.use()
    run(room, 4.5)
    expect(room.world.part(first, 'tank')?.status).toBe('broken')
    run(room, 3)
    expect(room.world.part(second, 'tank')?.status).toBe('broken')
  })

  it('a thrown item that names no explosive blasts a sphere of its own radius through the same detonation', () => {
    const base = makeRoom().arsenal.weapons.get('frag_grenade')
    if (!base || base.action.kind !== 'throwable') throw new Error('no frag_grenade')
    const { explosive: _removed, ...action } = base.action
    const room = makeRoom({ weapons: [{ ...base, id: 'plain_bomb', action }] })
    const explosions = explosionsOf(room)
    equip(room, 'plain_bomb')
    room.look([0, 1.7, 5], [0, 0.6, -3])
    room.use()
    run(room, 6)
    expect(explosions).toMatchObject([{ type: 'explosion', cause: 'timer', energy: action.energy, radius: action.radius }])
    expect(room.log.entries({ type: 'explode' })).toHaveLength(1)
  })
})
