import { describe, expect, it } from 'vitest'
import { TERRAIN_AREA_GROUND, createTerrainTestModule } from '@adatechnology/game-terrain-three'
import type { Vec3 } from '@adatechnology/game-destruction'
import { makeRoom } from './helpers'
import type { TestRoom } from '../src'

const FRAME = 1 / 60

const run = (room: TestRoom, seconds: number): void => {
  for (let elapsed = 0; elapsed < seconds; elapsed += FRAME) room.update(FRAME)
}

/** The ground area with its pond: the middle of the pond lot and the water there. */
const openPond = (): { room: TestRoom; centre: Vec3; level: number; depth: number } => {
  const room = makeRoom()
  room.loadModule(createTerrainTestModule())
  room.openArea('terrain')
  run(room, 2)
  const zone = (TERRAIN_AREA_GROUND.zones ?? []).find((lot) => lot.surface === 'pond')!
  const [x0, z0, x1, z1] = zone.rect
  const centre: Vec3 = [(x0 + x1) / 2, 0, (z0 + z1) / 2]
  const water = room.terrain.waterAt(centre[0], centre[2])!
  return { room, centre, level: water.level, depth: water.depth }
}

const lastOf = (room: TestRoom, type: string): Record<string, unknown> | undefined => room.log.entries({ type }).at(-1)?.data

describe('a blast in the pond: the water takes it as the charge and its depth say', () => {
  it('a charge on the bed goes off under the water: a dome and a column of white water', () => {
    const { room, centre, level, depth } = openPond()
    expect(depth).toBeGreaterThan(1)
    expect(room.blastAt('m67', [centre[0], level - depth + 0.05, centre[2]])).toBe(true)
    const data = lastOf(room, 'water_blast')!
    expect(data.underwater).toBe(true)
    expect(data.domeRadius as number).toBeGreaterThan(0)
    expect(data.columnHeight as number).toBeGreaterThan(1)
    run(room, 0.3)
    const drawn = room.scene.getObjectByName('water-effects')!
    expect(drawn.children.some((mesh) => ((mesh as unknown as { geometry: { instanceCount: number } }).geometry.instanceCount ?? 0) > 0)).toBe(true)
  })

  it('a charge at the surface throws a column, and a bigger charge a taller one', () => {
    const { room, centre, level } = openPond()
    room.blastAt('m79_40mm', [centre[0], level + 0.05, centre[2]])
    const small = lastOf(room, 'water_blast')!
    expect(small.underwater).toBe(false)
    expect(small.where).toBe('surface')
    run(room, 12)
    room.blastAt('c4', [centre[0], level - 0.4, centre[2]])
    const big = lastOf(room, 'water_blast')!
    expect(big.columnHeight as number).toBeGreaterThan(small.columnHeight as number)
  })

  it('a charge far from the water draws no water', () => {
    const { room } = openPond()
    const before = room.log.entries({ type: 'water_blast' }).length
    room.blastAt('m67', [0, 0.05, 6])
    expect(room.log.entries({ type: 'water_blast' })).toHaveLength(before)
  })
})

describe('rounds in the pond: a splash by calibre', () => {
  /** Fires `weapon` once at the middle of the pond, from over its near bank or from `from` (clear of the weights the area drops on each lot). */
  const fireInto = (weapon: string, from?: Vec3): Record<string, unknown> | undefined => {
    const { room, centre, level } = openPond()
    room.setTool(weapon)
    run(room, 1.5)
    room.tool.refill()
    const aside = from ? from[0] - centre[0] : 0
    room.look(from ?? [centre[0], level + 1.7, centre[2] + 2.5], [centre[0] + aside, level, centre[2]])
    room.use()
    run(room, 0.1)
    return lastOf(room, 'water_splash')
  }

  it('a pistol, a rifle and a heavy rifle throw columns that grow with the round', () => {
    const pistol = fireInto('glock_17')!
    const rifle = fireInto('ak_47')!
    const heavy = fireInto('barrett_m82a1')!
    expect(pistol.profile).toBe('pistol')
    expect(rifle.profile).toBe('rifle')
    expect(heavy.profile).toBe('sniper')
    expect(rifle.columnHeight as number).toBeGreaterThan(pistol.columnHeight as number)
    expect(heavy.columnHeight as number).toBeGreaterThan(rifle.columnHeight as number)
  })

  it('a shotgun load is buckshot: one line in the log for the load', () => {
    const shot = fireInto('remington_870')!
    expect(shot.profile).toBe('buckshot')
  })
  it('a round that grazes the water skips off it; a steep one goes in', () => {
    const zone = (TERRAIN_AREA_GROUND.zones ?? []).find((lot) => lot.surface === 'pond')!
    const [x0, z0, x1, z1] = zone.rect
    const grazing = fireInto('colt_m4a1', [(x0 + x1) / 2 + 1, 0.6, (z0 + z1) / 2 + 7])!
    expect(grazing.angleDeg as number).toBeLessThan(6)
    expect(grazing.ricochet).toBe(true)
    expect(fireInto('colt_m4a1')!.ricochet).toBe(false)
  })
})
