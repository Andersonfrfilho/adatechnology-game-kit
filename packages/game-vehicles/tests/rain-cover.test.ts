import { createRainCover } from '@adatechnology/game-contracts'
import type { Hit } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { buildVehicleItem, cabinBoxOf, createVehicleDestructible, type VehicleDestructible } from '../src'
import { createVehicleRainCover } from '../src'
import { makeKit } from './helpers/kit'

function make(key = 'proto') {
  const kit = makeKit({ locale: 'en' })
  const item = buildVehicleItem(kit, key)
  const d = createVehicleDestructible(kit, item.vehicle, { id: `${key}_1`, frame: item.root })
  const rain = createVehicleRainCover(d, { frame: item.root })
  const cover = createRainCover()
  cover.add(rain.source)
  rain.place()
  return { item, d, rain, cover }
}

const blast = (d: VehicleDestructible, part: string, energy = 3e6, radius = 0.8): Hit => {
  const at = d.partWorldCenter(part)
  return { type: 'explosive', point: [at[0], at[1] + 0.3, at[2]], energy, radius, tnt: radius > 1 ? 100 : 1 } as Hit
}

/** A point of the vehicle's own space, in the world as the car stands now. */
const world = (d: VehicleDestructible, x: number, y: number, z: number): THREE.Vector3 => (d.vehicle.vehicle as unknown as THREE.Object3D).localToWorld(new THREE.Vector3(x, y, z))
const overCabin = (d: VehicleDestructible): THREE.Vector3 => {
  const cabin = cabinBoxOf(d.vehicle)!
  return world(d, (cabin.x0 + cabin.x1) / 2, 1, 0)
}

describe('the rain cover of a vehicle', () => {
  it('roofs the cabin of a car at its roof, leaves the bonnet and the yard open', () => {
    const { d, cover } = make()
    const over = overCabin(d)
    const [x, z] = [over.x, over.z]
    const top = cover.coverTopAt(x, z)
    expect(top).toBeDefined()
    expect(top!).toBeGreaterThan(0.8)
    expect(top!).toBeLessThan(cabinBoxOf(d.vehicle)!.y1 + 0.2)
    expect(cover.coverTopAt(x + 30, z)).toBeUndefined()
    const hood = world(d, cabinBoxOf(d.vehicle)!.x1 + 0.6, 0.8, 0)
    expect(cover.coverTopAt(hood.x, hood.z)).toBeUndefined()
  })

  it('follows the car where it goes and turns, and the far curtain only recuts after a real move', () => {
    const { item, d, rain, cover } = make()
    const before = cover.version()
    item.root.position.set(0.2, 0, 0)
    item.root.updateMatrixWorld(true)
    rain.place()
    expect(cover.version()).toBe(before)
    item.root.position.set(8, 0, -3)
    item.root.rotation.set(0, Math.PI / 2, 0)
    item.root.updateMatrixWorld(true)
    rain.place()
    expect(cover.version()).toBeGreaterThan(before)
    const over = overCabin(d)
    const [x, z] = [over.x, over.z]
    expect(Math.hypot(x - 8, z + 3)).toBeLessThan(3)
    expect(cover.coverTopAt(x, z)).toBeDefined()
    expect(cover.coverTopAt(0, 0)).toBeUndefined()
  })

  it('lets the rain in where the windshield broke and keeps it out under the roof', () => {
    const { d, rain, cover } = make()
    const glass = d.partWorldCenter('windshield')
    expect(cover.coverTopAt(glass[0], glass[2])).toBeDefined()
    d.hit(blast(d, 'windshield'))
    expect(d.state().parts.find((p) => p.id === 'windshield')!.status).toBe('broken')
    rain.refreshShell()
    rain.place()
    expect(cover.coverTopAt(glass[0], glass[2])).toBeUndefined()
    const roof = d.model.parts.find((p) => p.role === 'roof')!
    const at = world(d, roof.box.center[0], 1, roof.box.center[2])
    expect(cover.coverTopAt(at.x, at.z)).toBeDefined()
  })

  it('covers nothing once the roof is gone, and nothing for a vehicle with no cabin', () => {
    const { d, rain, cover } = make()
    const over = overCabin(d)
    expect(cover.coverTopAt(over.x, over.z)).toBeDefined()
    // a roof that tears off the car leaves the main group of parts
    d.hit(blast(d, 'roof', 5e7, 6))
    expect(d.state().groups[0]).not.toContain('roof')
    rain.refreshShell()
    rain.place()
    expect(cover.coverTopAt(over.x, over.z)).toBeUndefined()
    const bike = make('bike')
    const at = bike.item.root.position
    expect(bike.cover.coverTopAt(at.x, at.z)).toBeUndefined()
  })

  it('covers nothing for a car on its side', () => {
    const { item, d, rain, cover } = make()
    const over = overCabin(d)
    const [x, z] = [over.x, over.z]
    expect(cover.coverTopAt(x, z)).toBeDefined()
    item.root.rotation.set(0, 0, Math.PI / 2)
    item.root.updateMatrixWorld(true)
    rain.place()
    expect(cover.coverTopAt(x, z)).toBeUndefined()
  })
})
