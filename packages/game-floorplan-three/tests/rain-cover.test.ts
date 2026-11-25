import { createRainCover } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { addHouseRainCover } from '../src/rain-cover'
import { fakeRoom } from './helpers/area-room'
import { houseOf, planOf, THREE } from './helpers/houses'

/** The kitchen of single_storey_a (house-local), as the grenade test throws into it. */
const KITCHEN = new THREE.Vector3(2.4, 1.0, 8.8)
const YARD = new THREE.Vector3(-1.5, 0, -1.5)

const built = () => {
  const r = fakeRoom()
  r.set('template', 'single_storey_a')
  r.set('seed', 1)
  r.act('build')
  r.frame(0.2)
  const { house } = r.module.houses[0]!
  const cover = createRainCover()
  const remove = addHouseRainCover(cover, house)
  const world = (local: THREE.Vector3): THREE.Vector3 => house.group.localToWorld(local.clone())
  return { r, house, cover, remove, world }
}

describe('the rain cover of a house', () => {
  it('covers the rooms up to the top of the roof, leaves the yard open and goes away with the house', () => {
    const { house, cover, remove, world } = built()
    const inside = world(KITCHEN)
    const yard = world(YARD)
    const top = cover.coverTopAt(inside.x, inside.z)
    expect(top).toBeGreaterThan(2.5)
    expect(cover.coverTopAt(yard.x, yard.z)).toBeUndefined()
    expect(house.destruction.spec).not.toBeNull()
    remove()
    expect(cover.coverTopAt(inside.x, inside.z)).toBeUndefined()
  })

  it('opens when the roof and the slabs over a room are destroyed, and only over that room', () => {
    const { r, house, cover, world } = built()
    const inside = world(KITCHEN)
    const otherRoom = world(new THREE.Vector3(7.5, 1, 2))
    expect(cover.coverTopAt(otherRoom.x, otherRoom.z)).toBeDefined()
    const before = cover.version()
    const covers = (house.destruction.spec?.parts ?? []).filter((part) => part.structure && (part.structure.role === 'roof' || part.structure.role === 'slab'))
    const over = covers.filter((part) => Math.abs(part.position[0] - KITCHEN.x) <= (part.shape.kind === 'box' ? part.shape.size[0] / 2 : 0) && Math.abs(part.position[2] - KITCHEN.z) <= (part.shape.kind === 'box' ? part.shape.size[2] / 2 : 0))
    expect(over.length).toBeGreaterThan(0)
    for (const part of over) r.world.hitPart(house.destruction.id!, part.id, { type: 'explosive', point: [inside.x, inside.y + 1, inside.z], energy: 5e8, radius: 6, tnt: 100 })
    r.frame(0.5, 0.05)
    expect(cover.version()).toBeGreaterThan(before)
    expect(cover.coverTopAt(inside.x, inside.z)).toBeUndefined()
    expect(cover.coverTopAt(otherRoom.x, otherRoom.z)).toBeDefined()
  }, 120000)
})

describe('the rain cover of what a plan puts in the yard and under the porch', () => {
  it('roofs a sauna at its height, turned as it stands, and not a pergola', () => {
    const plan = planOf('single_storey_a', 1) as unknown as { items: Array<Record<string, unknown>> }
    const stand = { room: null, floor: 0, outdoor: true, y: 0, category: 'yard' }
    plan.items.push({ ...stand, id: 'sauna_t', type: 'sauna', x: -6, z: -3, ry: Math.PI / 2, w: 2, d: 1, h: 2.1 }, { ...stand, id: 'pergola_t', type: 'pergola', x: -6, z: 4, ry: 0, w: 3.5, d: 3, h: 2.4 })
    const { house } = houseOf(plan as never)
    const cover = createRainCover()
    addHouseRainCover(cover, house)
    const at = (x: number, z: number): number | undefined => {
      const world = house.group.localToWorld(new THREE.Vector3(x, 0, z))
      return cover.coverTopAt(world.x, world.z)
    }
    expect(at(-6, -3)).toBeCloseTo(house.group.localToWorld(new THREE.Vector3(-6, 2.1, -3)).y, 3)
    // turned a quarter: its 2 m run along z now, its 1 m along x
    expect(at(-6, -3.9)).toBeDefined()
    expect(at(-6.9, -3)).toBeUndefined()
    expect(at(-6, 4)).toBeUndefined()
  })
})

describe('the rain cover of an outbuilding', () => {
  it('roofs the edicula of the lot at the top of its slab, though its walls are no part of the structure', () => {
    const plan = planOf('single_storey_a', 1) as unknown as { outbuildings?: Array<{ id: string; aabb: number[]; ceiling: number }> }
    expect(plan.outbuildings?.length).toBeGreaterThan(0)
    const { house } = houseOf(plan as never)
    const cover = createRainCover()
    addHouseRainCover(cover, house)
    const building = plan.outbuildings![0]!
    const [u0, v0, u1, v1] = building.aabb as [number, number, number, number]
    const world = house.group.localToWorld(new THREE.Vector3((u0 + u1) / 2, 0, (v0 + v1) / 2))
    expect(cover.coverTopAt(world.x, world.z)).toBeCloseTo(building.ceiling + 0.2, 3)
    const beside = house.group.localToWorld(new THREE.Vector3(u1 + 1.5, 0, (v0 + v1) / 2))
    expect(cover.coverTopAt(beside.x, beside.z)).toBeUndefined()
  })
})

describe('the rain cover of the porch and the garage', () => {
  it('roofs the porch of a log cabin with its own lower roof and the garage of a wood frame house under the house roof', () => {
    for (const [template, type] of [['log_cabin', 'porch'], ['wood_frame_house', 'garage']] as const) {
      const r = fakeRoom()
      r.set('template', template)
      r.set('seed', 1)
      r.act('build')
      r.frame(0.2)
      const { house } = r.module.houses[0]!
      const cover = createRainCover()
      addHouseRainCover(cover, house)
      const room = house.r.rooms.find((candidate) => candidate.type === type)!
      const world = house.group.localToWorld(new THREE.Vector3((room.u0 + room.u1) / 2, 1, (room.v0 + room.v1) / 2))
      const top = cover.coverTopAt(world.x, world.z)
      expect(top, `${template} ${type}`).toBeGreaterThan(2.2)
      const living = house.r.rooms.find((candidate) => candidate.type === 'living')!
      const inside = house.group.localToWorld(new THREE.Vector3((living.u0 + living.u1) / 2, 1, (living.v0 + living.v1) / 2))
      const houseTop = cover.coverTopAt(inside.x, inside.z)!
      if (type === 'porch') expect(top!).toBeLessThan(houseTop)
    }
  }, 120000)
})
