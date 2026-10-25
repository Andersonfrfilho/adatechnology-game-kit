import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createVehicleKit } from '@adatechnology/game-vehicles'
import { fleetDims, fleetVehicleIds, installFleet } from '@adatechnology/game-vehicles-fleet'
import { createVehiclesThree } from '../src'
import { fakeDocument } from './fake-dom'

/* the builds are long synchronous loops: let the worker report between tests */
afterEach(() => new Promise((resolve) => setImmediate(resolve)))

const kit = createVehicleKit({ THREE, document: fakeDocument })
installFleet(kit)
const vehicles = createVehiclesThree(THREE, { kit })

describe('golden: DIMS of the Frota Leve (G-dims)', () => {
  it.each([...fleetVehicleIds])('%s measures what the team measured, to the millimetre', (id) => {
    const built = vehicles.build(id, { quality: 'lite' })
    const want = fleetDims(id)!
    expect(Math.abs(built.length - want.length), 'length').toBeLessThanOrEqual(0.0011)
    expect(Math.abs(built.width - want.width), 'width').toBeLessThanOrEqual(0.0011)
    expect(Math.abs(built.height - want.height), 'height').toBeLessThanOrEqual(0.0011)
    expect(built.expected).toEqual(want)
    built.dispose()
  })
})

describe('colour and frame', () => {
  it('paints by seed from the palette of the group, and a given colour wins', () => {
    expect(vehicles.build('compact_hatch', { quality: 'lite', seed: 3 }).color).toBe(vehicles.build('compact_hatch', { quality: 'lite', seed: 3 }).color)
    expect(vehicles.build('compact_hatch', { quality: 'lite', color: '#123456', seed: 3 }).color).toBe('#123456')
    expect(['#4b5320', '#b9a36a', '#4a4d4f', '#3b4a33', '#5d6350']).toContain(vehicles.build('battle_tank', { quality: 'lite', seed: 11 }).color)
  })

  it('puts the front on +z, centres the vehicle and rests it on the ground', () => {
    const built = vehicles.build('midsize_sedan', { quality: 'lite' })
    const box = new THREE.Box3().setFromObject(built.group)
    expect(box.min.y).toBeCloseTo(0, 6)
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 3)
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(0, 3)
    expect(built.length).toBeGreaterThan(built.width)
    expect(built.group.userData.damageables).toBe(built.damageables)
  })

  it('keeps the kit context and tags the damageable meshes at high quality only', () => {
    const high = vehicles.build('compact_hatch', { quality: 'high' })
    expect(high.context).toBeTruthy()
    let tagged = 0
    high.group.traverse((o: any) => {
      if (o.userData.damageable) tagged++
    })
    expect(tagged).toBeGreaterThan(0)
    expect(vehicles.build('compact_hatch', { quality: 'lite' }).context).toBeNull()
  })
})
