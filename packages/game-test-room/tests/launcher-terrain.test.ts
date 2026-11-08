import { describe, expect, it } from 'vitest'
import { TERRAIN_AREA_GROUND, TERRAIN_STRIPS, createTerrainTestModule } from '@adatechnology/game-terrain-three'
import type { HostEvent } from '@adatechnology/game-contracts'
import type { Vec3 } from '@adatechnology/game-destruction'
import { makeRoom } from './helpers'
import type { TestRoom } from '../src'

const FRAME = 1 / 60
/** Where the player stands when the ground area opens (`createTerrainTestModule`'s view). */
const EYE: Vec3 = [0, 1.7, 1.5]

const explosionsOf = (room: TestRoom): HostEvent[] => {
  const events: HostEvent[] = []
  room.loadModule({ id: 'spy', name: 'spy', group: 'spy', items: () => [], attach: (host) => host.on((event) => event.type === 'explosion' && events.push(event)) })
  return events
}

const run = (room: TestRoom, seconds: number, until?: () => boolean): void => {
  for (let elapsed = 0; elapsed < seconds && !until?.(); elapsed += FRAME) room.update(FRAME)
}

/** The rounds still in the scene: the launched ones and a dud lying anywhere. */
const roundsLeft = (room: TestRoom): number => {
  let count = 0
  room.scene.traverse((object) => {
    if (object.userData.dud === true) count++
  })
  return count
}

/** The middle of the near half of each lot, where nothing of the area stands. */
const lotTargets = (): { surface: string; target: Vec3 }[] =>
  (TERRAIN_AREA_GROUND.zones ?? []).map((zone) => {
    const [x0, , x1, z1] = zone.rect
    return { surface: zone.surface, target: [(x0 + x1) / 2, 0, z1 - 0.8] }
  })

const LAUNCHERS = [...makeRoom().arsenal.weapons.values()].filter((def) => def.action.kind === 'launcher' && def.action.projectile).map((def) => def.id)

type Area = {
  readonly room: TestRoom
  /** Fires the launcher in hand from `from` at `target` and waits for a blast; returns it, or undefined when none came. */
  readonly fireAt: (from: Vec3, target: Vec3) => Extract<HostEvent, { type: 'explosion' }> | undefined
  /** Where the eye is when standing at `x`, `z`. */
  readonly eyeAt: (x: number, z: number) => Vec3
}

/** A fresh room with the ground area open and `weapon` in hand: the craters and the debris of other launchers do not count. */
const openGroundArea = (weapon: string): Area => {
  const room = makeRoom()
  const explosions = explosionsOf(room)
  room.loadModule(createTerrainTestModule())
  room.openArea('terrain')
  run(room, 3)
  room.setTool(weapon)
  run(room, 1)
  const fireAt = (from: Vec3, target: Vec3): Extract<HostEvent, { type: 'explosion' }> | undefined => {
    room.tool.refill()
    const before = explosions.length
    room.look(from, target)
    let status = room.use()
    for (let waited = 0; status !== 'ok' && waited < 8; waited += 0.25) {
      run(room, 0.25)
      room.tool.refill()
      room.look(from, target)
      status = room.use()
    }
    expect(status).toBe('ok')
    run(room, 4, () => explosions.length > before)
    const blast = explosions[before]
    return blast?.type === 'explosion' ? blast : undefined
  }
  return { room, fireAt, eyeAt: (x, z) => [x, room.terrain.heightAt(x, z) + EYE[1], z] }
}

/** The ground of the room around `target` as it is now, read every 5 cm: what a round must meet before its own blast digs it deeper. */
const groundNow = (room: TestRoom, target: Vec3): ((x: number, z: number) => number) => {
  const half = 2
  const cell = 0.05
  const size = Math.round((2 * half) / cell) + 1
  const heights = new Float64Array(size * size)
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) heights[i * size + j] = room.terrain.heightAt(target[0] - half + i * cell, target[2] - half + j * cell)
  return (x, z) => {
    const i = Math.min(size - 1, Math.max(0, Math.round((x - target[0] + half) / cell)))
    const j = Math.min(size - 1, Math.max(0, Math.round((z - target[2] + half) / cell)))
    return heights[i * size + j]!
  }
}

/** Loose grounds a blast digs (the paved ones take none). */
const DIGGABLE = ['lawn', 'dirt', 'sand', 'mud', 'dry_clay']

/** Metres above the ground a round goes off when it hits the ground (its radius, `GROUND_CLEARANCE` of the explosives). */
const ON_GROUND = 0.12

describe('every launcher in the ground area goes off on every lot (it never stops and lies on the ground)', () => {
  it('the area has every ground of the kit, and the launchers are all there', () => {
    expect(lotTargets().map((lot) => lot.surface)).toEqual([...TERRAIN_STRIPS])
    expect(LAUNCHERS).toEqual(expect.arrayContaining(['rpg_7', 'm72_law', 'at4', 'carl_gustaf_m4', 'm203', 'gp_25', 'ag36', 'm32_mgl', 'm79']))
  })

  for (const weapon of LAUNCHERS) {
    it(`${weapon}: one round at each lot, from where the player arrives`, () => {
      const { room, fireAt } = openGroundArea(weapon)
      for (const { surface, target } of lotTargets()) {
        // the player aims at what is seen there: the water of a pond, not its bed
        const aim: Vec3 = [target[0], room.terrain.waterAt(target[0], target[2])?.level ?? room.terrain.heightAt(target[0], target[2]), target[2]]
        const blast = fireAt(EYE, aim)
        expect(blast, `${weapon} on ${surface}`).toMatchObject({ type: 'explosion', cause: 'impact' })
        const [x, y, z] = blast!.point
        // on the lot, or on something of the room standing in the way (the table, the shelf, the wall): never short of it lying on the ground
        const isOnGround = y - room.terrain.heightAt(x, z) < ON_GROUND
        // the round leaves the muzzle, a little under the eye, so at a shallow sight line it lands short of where the eye aims, but on that line
        if (isOnGround) {
          const range = Math.hypot(target[0] - EYE[0], target[2] - EYE[2])
          const way = [(target[0] - EYE[0]) / range, (target[2] - EYE[2]) / range] as const
          const along = (x - EYE[0]) * way[0] + (z - EYE[2]) * way[1]
          const aside = Math.abs((x - EYE[0]) * way[1] - (z - EYE[2]) * way[0])
          expect(aside, `${weapon} on ${surface}`).toBeLessThan(1.2)
          expect(along, `${weapon} on ${surface}`).toBeGreaterThan(0.5 * range)
          // never under the ground it flew over
          expect(y - room.terrain.heightAt(x, z), `${weapon} on ${surface}`).toBeGreaterThan(-0.02)
        }
        expect(roundsLeft(room)).toBe(0)
      }
      expect(room.log.entries({ type: 'dud' })).toHaveLength(0)
    })

    it(`${weapon}: a second round into the crater the first one dug goes off on its bottom`, () => {
      const { room, fireAt, eyeAt } = openGroundArea(weapon)
      for (const { surface, target } of lotTargets()) {
        const spot: Vec3 = [target[0], 0, target[2]]
        const from = eyeAt(spot[0] + 0.3, spot[2] + 3)
        const flat = room.terrain.heightAt(spot[0], spot[2])
        const first = fireAt(from, spot)
        expect(first, `${weapon} on ${surface}`).toMatchObject({ type: 'explosion', cause: 'impact' })
        const [cx, cy, cz] = first!.point
        // an impact fuze goes off on the water: there is no crater to fire into, and the second round goes off on the water again
        const water = room.terrain.waterAt(cx, cz)
        if (water) {
          expect(cy, `${weapon} on the water of ${surface}`).toBeCloseTo(water.level, 1)
          const again = fireAt(eyeAt(cx + 0.3, cz + 3), [cx, water.level, cz])
          expect(again!.point[1], `${weapon} on the water of ${surface}`).toBeCloseTo(water.level, 1)
          expect(roundsLeft(room)).toBe(0)
          continue
        }
        const dug = room.terrain.heightAt(cx, cz)
        if (DIGGABLE.includes(surface)) expect(dug, `${weapon} digs ${surface}`).toBeLessThan(flat - 0.02)
        const before = groundNow(room, [cx, 0, cz])
        const blast = fireAt(eyeAt(cx + 0.3, cz + 3), [cx, dug, cz])
        expect(blast, `${weapon} into the crater on ${surface}`).toMatchObject({ type: 'explosion', cause: 'impact' })
        const [x, y, z] = blast!.point
        // on the ground as the first blast left it (the round's radius above it): never under it, nor up on a rim it did not reach
        expect(y - before(x, z), `${weapon} into the crater on ${surface}`).toBeGreaterThan(-0.02)
        expect(y - before(x, z), `${weapon} into the crater on ${surface}`).toBeLessThan(ON_GROUND)
        expect(Math.hypot(x - cx, z - cz), `${weapon} into the crater on ${surface}`).toBeLessThan(0.6)
        // in the hole the first blast dug, not up above it
        expect(y, `${weapon} into the crater on ${surface}`).toBeLessThan(Math.max(dug, flat) + ON_GROUND)
        expect(roundsLeft(room)).toBe(0)
      }
    })

    it(`${weapon}: point blank at the feet and grazing along the lots`, () => {
      const { room, fireAt, eyeAt } = openGroundArea(weapon)
      const [x, , z] = lotTargets()[12]!.target
      expect(fireAt(eyeAt(x, z + 0.6), [x, 0, z])).toMatchObject({ type: 'explosion', cause: 'impact' })
      const grazing = fireAt([x, room.terrain.heightAt(x, z + 1) + 0.4, z + 1], [x + 0.2, 0, z - 8])
      expect(grazing).toMatchObject({ type: 'explosion', cause: 'impact' })
      expect(roundsLeft(room)).toBe(0)
    })
  }
})
