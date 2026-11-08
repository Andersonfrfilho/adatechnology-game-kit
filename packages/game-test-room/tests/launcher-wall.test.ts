import { describe, expect, it } from 'vitest'
import type { HostEvent } from '@adatechnology/game-contracts'
import type { Vec3 } from '@adatechnology/game-destruction'
import { makeRoom } from './helpers'
import type { TestRoom } from '../src'

const FRAME = 1 / 60
/** The brick wall of the arena stands 11 m ahead of the start (`target_wall`). */
const WALL_Z = -11
/** Closer than any fuze arms (10 m for a rocket, 14 m and more for a 40 mm grenade). */
const STAND_Z = -6

type Explosion = Extract<HostEvent, { type: 'explosion' }>

const run = (room: TestRoom, seconds: number, until?: () => boolean): void => {
  for (let elapsed = 0; elapsed < seconds && !until?.(); elapsed += FRAME) room.update(FRAME)
}

const roundsLeft = (room: TestRoom): number => {
  let count = 0
  room.scene.traverse((object) => {
    if (object.userData.dud === true) count++
  })
  return count
}

const LAUNCHERS = [...makeRoom().arsenal.weapons.values()].filter((def) => def.action.kind === 'launcher' && def.action.projectile).map((def) => def.id)

const armed = (weapon: string): { room: TestRoom; fireAt: (from: Vec3, target: Vec3) => Explosion | undefined } => {
  const room = makeRoom()
  const explosions: Explosion[] = []
  room.loadModule({ id: 'spy', name: 'spy', group: 'spy', items: () => [], attach: (host) => host.on((event) => event.type === 'explosion' && explosions.push(event)) })
  run(room, 1)
  room.setTool(weapon)
  run(room, 1)
  const fireAt = (from: Vec3, target: Vec3): Explosion | undefined => {
    const before = explosions.length
    let status = 'none'
    for (let waited = 0; status !== 'ok' && waited < 8; waited += 0.25) {
      room.tool.refill()
      room.look(from, target)
      status = room.use()
      if (status !== 'ok') run(room, 0.25)
    }
    expect(status).toBe('ok')
    run(room, 4, () => explosions.length > before)
    // what the blast threw settles before the next round
    run(room, 1.5)
    return explosions[before]
  }
  return { room, fireAt }
}

describe('a wall the first round already broke still sets off every round after it (none bounces off)', () => {
  for (const weapon of LAUNCHERS) {
    it(`${weapon}: four rounds at the same spot, one at the edge of the hole and one at the rubble at its foot`, () => {
      const { room, fireAt } = armed(weapon)
      const from: Vec3 = [0.3, 1.7, STAND_Z]
      const targets: readonly (readonly [string, Vec3])[] = [
        ['first', [0, 1.4, WALL_Z]],
        ['same spot (damaged)', [0, 1.4, WALL_Z]],
        ['same spot (hole)', [0, 1.4, WALL_Z]],
        ['same spot (again)', [0, 1.4, WALL_Z]],
        ['edge of the hole', [0.9, 1.1, WALL_Z]],
        ['rubble at its foot', [0, 0.05, WALL_Z + 0.8]],
      ]
      for (const [label, target] of targets) {
        const blast = fireAt(from, target)
        expect(blast, `${weapon} ${label}`).toMatchObject({ type: 'explosion', cause: 'impact' })
        // it went off on its way to the wall, at the wall or past a hole it opened: never back towards the shooter
        expect(blast!.point[2], `${weapon} ${label}`).toBeLessThan(STAND_Z - 1)
        expect(roundsLeft(room), `${weapon} ${label}`).toBe(0)
      }
      expect(room.log.entries({ type: 'dud' })).toHaveLength(0)
    })
  }
})
