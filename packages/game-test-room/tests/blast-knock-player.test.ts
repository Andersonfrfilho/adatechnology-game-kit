import { describe, expect, it } from 'vitest'
import type { HostEvent, Vec3 } from '@adatechnology/game-contracts'
import * as THREE from 'three'
import { makeRoom } from './helpers'
import type { TestRoom } from '../src'

const run = (room: TestRoom, seconds: number, each?: () => void): void => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) {
    room.update(1 / 60)
    each?.()
  }
}

type Explosion = Extract<HostEvent, { type: 'explosion' }>

/**
 * Throws a grenade from (0, 1.7, 5) toward -z (it comes to rest near z = -5) and lets it go off. Once it lies still, `before` runs (stand the player somewhere, put up a wall).
 * Returns the explosion, where the feet were then, what the log says the blast did to the player, and whether the body went down.
 */
const grenade = (room: TestRoom, before?: () => void) => {
  const explosions: Explosion[] = []
  room.loadModule({ id: 'spy', name: 'spy', group: 'spy', items: () => [], attach: (host) => host.on((event) => void (event.type === 'explosion' && explosions.push(event))) })
  room.setTool('frag_grenade')
  run(room, 0.5)
  room.look([0, 1.7, 5], [0, 0.6, 1.5])
  room.use()
  run(room, 2.5)
  before?.()
  let feet: readonly number[] | undefined
  let bodyDown = false
  run(room, 4, () => {
    if (explosions.length && !feet) feet = [...room.playerPosition]
    bodyDown ||= room.avatarState().down
  })
  const shove = room.log.entries().find((e) => e.type === 'player_knocked_down' || e.type === 'player_shoved')
  return { explosion: explosions[0], feet, shove, bodyDown }
}

/** A charge of `tnt` kg set off at `at` (a part that bursts when it is destroyed, as a gas bottle): the blast reaches the player like any other. */
const charge = (room: TestRoom, at: Vec3, tnt: number, lethalRadius = 0) => {
  room.world.add(
    { parts: [{ id: 'charge', material: 'steel', shape: { kind: 'box', size: [0.2, 0.2, 0.2] }, position: [0, 0.1, 0], explodes: { energy: tnt * 830_000, radius: 15, lethalRadius, tnt } }] },
    { id: 'probe_charge', position: at },
  )
  // set it off: the part is destroyed and bursts
  room.world.hitPart('probe_charge', 'charge', { type: 'blunt', point: [at[0], at[1] + 0.1, at[2]], direction: [0, -1, 0], energy: 1e9, radius: 0.2 })
}
const entry = (room: TestRoom, ...types: string[]) => room.log.entries().find((e) => types.includes(e.type))

describe('a blast on the player', () => {
  it('a grenade 3 m away fells the player where they stand, wounded and stunned: it does not throw them, and they get up again', () => {
    const room = makeRoom()
    const near = () => room.look([0, 1.7, -2], [0, 1.7, -6])
    const { explosion, feet } = grenade(room, near)
    expect(explosion).toBeDefined()
    expect(explosion!.tnt).toBeCloseTo(0.24)
    const hit = entry(room, 'player_wounded')
    expect(hit).toBeDefined()
    expect(Number(hit!.data?.stunSeconds)).toBeGreaterThan(1)
    expect(hit!.data?.down).toBe(true)
    const now = room.playerPosition
    expect(Math.hypot(now[0] - feet![0]!, now[2] - feet![2]!)).toBeLessThan(0.3)
    run(room, 12)
    expect(room.playerKnock).toBeNull()
  })

  it('falls on its back facing the blast and face down with the blast behind it', () => {
    const fell = (target: number[]) => {
      const room = makeRoom()
      // a body to read what the room tells it while down
      let forward: boolean | undefined
      room.setAvatar({ root: new THREE.Group(), update: (_dt, state) => void (state.down && (forward = state.fallForward)) })
      // the grenade lies near z = -5: looking at -z the body faces it, at +z turns its back
      grenade(room, () => room.look([0, 1.7, -3.2], target as [number, number, number]))
      return { forward, room }
    }
    const facing = fell([0, 1.7, -8])
    const turned = fell([0, 1.7, 2])
    expect(entry(facing.room, 'player_wounded', 'player_knocked_down')).toBeDefined()
    expect(entry(turned.room, 'player_wounded', 'player_knocked_down')).toBeDefined()
    expect(facing.forward).toBe(false)
    expect(turned.forward).toBe(true)
  })

  it('a brick wall between the blast and the player stops the fragments: no wounds', () => {
    const room = makeRoom()
    grenade(room, () => {
      room.look([0, 1.7, -2], [0, 1.7, -6])
      room.world.add({ parts: [{ id: 'wall', material: 'brick', shape: { kind: 'box', size: [8, 3, 0.25] }, position: [0, 1.5, -3.2] }] }, { id: 'probe_wall' })
    })
    expect(entry(room, 'player_wounded', 'player_knocked_down')).toBeUndefined()
  })

  it('a big charge close throws the player; the same charge far only stuns', () => {
    const near = makeRoom()
    near.look([0, 1.7, 0], [0, 1.7, -6])
    charge(near, [0, 0, 1.2], 5)
    run(near, 0.2)
    const thrown = entry(near, 'player_knocked_down')
    expect(thrown).toBeDefined()
    expect(Number(thrown!.data?.speed)).toBeGreaterThan(3)
    const far = makeRoom()
    far.look([0, 1.7, 0], [0, 1.7, -6])
    charge(far, [0, 0, 12], 5)
    run(far, 0.2)
    expect(entry(far, 'player_knocked_down', 'player_wounded')).toBeUndefined()
  })

  it('a body thrown into a wall slams into it: the wall takes the blow, the player hits it and stops', () => {
    const room = makeRoom()
    room.look([0, 1.7, -2], [0, 1.7, -6])
    // a steel sheet right behind the player, where the blast throws it
    const sheet = room.spawn('steel_sheet', [0, 0, -3.3], 0).objectId
    run(room, 0.5)
    charge(room, [0, 0, -0.8], 5)
    run(room, 3)
    expect(entry(room, 'player_knocked_down')).toBeDefined()
    const slam = room.log.entries().find((e) => e.type === 'player_slammed' && e.data?.against === 'obstacle')
    expect(slam).toBeDefined()
    expect(slam!.objectId).toBe(sheet)
    const steel = room.world.part(sheet, 'sheet')!
    expect(steel.hp).toBeLessThan(steel.maxHp)
    // steel holds: the body never went through it
    expect(room.playerPosition[2]).toBeGreaterThan(-3.3)
  })
})
