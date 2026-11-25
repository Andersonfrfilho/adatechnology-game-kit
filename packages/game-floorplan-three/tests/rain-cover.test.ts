import { createRainCover } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { addHouseRainCover } from '../src/rain-cover'
import { fakeRoom } from './helpers/area-room'
import { THREE } from './helpers/houses'

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
