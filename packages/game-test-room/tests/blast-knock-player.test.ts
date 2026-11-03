import { describe, expect, it } from 'vitest'
import type { HostEvent } from '@adatechnology/game-contracts'
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

describe('a blast shoves the player', () => {
  it('throws the player away from the centre, off its feet when close, and the player gets up again', () => {
    const room = makeRoom()
    const { explosion, feet, shove } = grenade(room)
    expect(explosion).toBeDefined()
    expect(shove).toBeDefined()
    expect(shove!.data?.speed).toBeGreaterThan(0)
    const now = room.playerPosition
    const before = Math.hypot(feet![0]! - explosion!.point[0], feet![2]! - explosion!.point[2])
    const after = Math.hypot(now[0] - explosion!.point[0], now[2] - explosion!.point[2])
    expect(after).toBeGreaterThan(before)
    run(room, 10)
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
      return { state: { fallForward: forward }, room }
    }
    const facing = fell([0, 1.7, -8])
    const turned = fell([0, 1.7, 2])
    expect(facing.room.log.entries().some((e) => e.type === 'player_knocked_down')).toBe(true)
    expect(turned.room.log.entries().some((e) => e.type === 'player_knocked_down')).toBe(true)
    expect(facing.state?.fallForward).toBe(false)
    expect(turned.state?.fallForward).toBe(true)
  })

  it('a brick wall between the blast and the player takes most of the push', () => {
    // the player stands 3 m from where the grenade lies; in the second room a brick wall goes up between them
    const near = (room: TestRoom) => () => room.look([0, 1.7, -2], [0, 1.7, -6])
    const openRoom = makeRoom()
    const open = grenade(openRoom, near(openRoom))
    const room = makeRoom()
    const covered = grenade(room, () => {
      near(room)()
      room.world.add({ parts: [{ id: 'wall', material: 'brick', shape: { kind: 'box', size: [8, 3, 0.25] }, position: [0, 1.5, -3.2] }] }, { id: 'probe_wall' })
    })
    expect(open.shove?.data?.down).toBe(true)
    expect(open.shove?.data?.reach).toBe(1)
    const coveredSpeed = Number(covered.shove?.data?.speed ?? 0)
    expect(coveredSpeed).toBeLessThan(Number(open.shove!.data!.speed) * 0.5)
  })

  it('a body thrown into a wall slams into it: the wall takes the blow, the player hits it and stops', () => {
    const room = makeRoom()
    const near = () => room.look([0, 1.7, -2], [0, 1.7, -6])
    let sheet = ''
    const result = grenade(room, () => {
      near()
      // a steel sheet right behind the player, where the blast throws it
      sheet = room.spawn('steel_sheet', [0, 0, -1.3], 0).objectId
    })
    expect(result.shove?.type).toBe('player_knocked_down')
    const slam = room.log.entries().find((e) => e.type === 'player_slammed' && e.data?.against === 'obstacle')
    expect(slam).toBeDefined()
    expect(slam!.objectId).toBe(sheet)
    const steel = room.world.part(sheet, 'sheet')!
    expect(steel.hp).toBeLessThan(steel.maxHp)
    // steel holds: the body never went through it
    expect(room.playerPosition[2]).toBeLessThan(-1.3)
  })
})
