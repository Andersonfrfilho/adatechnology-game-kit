import { createUrban } from '@adatechnology/game-urban'
import { createPlantProvider, createVehicleProvider, defaultPlantSpec } from '@adatechnology/game-kit-defaults'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { createPlantResolver, createUrbanThree, createVehicleResolver } from '../src'
import { fakeDocument } from './fake-dom'

const placed = (root: any, kind: string): any[] => {
  const found: any[] = []
  root.traverse((o: any) => {
    if (o.userData?.placement?.kind === kind) found.push(o)
  })
  return found
}

/** A vehicle builder that gives a box of the size of a car, as `createVehiclesThree(...).build` gives a group. */
const stubVehicles = () => {
  const calls: { key: string; options: any }[] = []
  return {
    calls,
    build: (key: string, options: any = {}) => {
      calls.push({ key, options })
      const group = new THREE.Group()
      group.add(new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 4.2), new THREE.MeshBasicMaterial()))
      return { group, dispose: () => undefined }
    },
  }
}

describe('placements drawn with the resolvers of the vehicles and plants', () => {
  const kit = createUrban()

  it('leaves a placement empty when no resolver is given', () => {
    const b = kit.builder({ seed: 7 })
    kit.neighbourhoods.get('downtown').compose(b, { x: 0, z: 0 }, { providers: { vehicle: createVehicleProvider() } })
    const drawn = createUrbanThree(THREE, { document: fakeDocument }).draw(b.scene())
    const cars = placed(drawn.root, 'vehicle')
    expect(cars).toHaveLength(1)
    expect(cars[0].children).toHaveLength(0)
  })

  it('puts the vehicle of the fleet where the pattern parks, turned and painted as asked', () => {
    const b = kit.builder({ seed: 7 })
    const plan = kit.neighbourhoods.get('downtown').compose(b, { x: 10, z: 20 }, { providers: { vehicle: createVehicleProvider({ ids: ['taxi'] }) } })
    const vehicles = stubVehicles()
    const resolver = createVehicleResolver(vehicles)
    const drawn = createUrbanThree(THREE, { document: fakeDocument, resolvers: { vehicle: resolver } }).draw(b.scene())
    const [car] = placed(drawn.root, 'vehicle')
    const request = plan.vehicles[0]!
    expect(car.userData.placement.id).toBe('taxi')
    expect(car.position.x).toBe(request.x)
    expect(car.position.z).toBe(request.z)
    expect(car.rotation.y).toBeCloseTo(request.ry, 9)
    expect(car.children).toHaveLength(1)
    expect(vehicles.calls[0]).toEqual({ key: 'taxi', options: { quality: 'lite', color: `#${request.color.toString(16).padStart(6, '0')}` } })
  })

  it('builds a vehicle once for each id and paint and shares its geometry between the spots', () => {
    const vehicles = stubVehicles()
    const resolver = createVehicleResolver(vehicles, { quality: 'high' })
    const part = { shape: 'placement', parent: -1, kind: 'vehicle', id: 'taxi', x: 0, y: 0, z: 0, ry: 0, scale: 1, color: 0xff0000, seed: 'a' } as const
    const first = resolver(part)
    const second = resolver({ ...part, x: 5 })
    expect(vehicles.calls).toHaveLength(1)
    expect(vehicles.calls[0]!.options.quality).toBe('high')
    expect(first).not.toBe(second)
    expect(first.children[0].geometry).toBe(second.children[0].geometry)
    resolver({ ...part, color: 0x00ff00 })
    expect(vehicles.calls).toHaveLength(2)
  })

  it('a vehicle the builder cannot make leaves the spot empty instead of stopping the scene', () => {
    const resolver = createVehicleResolver({ build: () => { throw new Error('no such vehicle') } })
    expect(resolver({ shape: 'placement', parent: -1, kind: 'vehicle', id: 'nope', x: 0, y: 0, z: 0, ry: 0, scale: 1, seed: 1 })).toBeNull()
  })

  it('puts the species of the pack where the pattern plants, scaled as asked', () => {
    const b = kit.builder({ seed: 7 })
    const plan = kit.neighbourhoods.get('mountain_resort').compose(b, { x: 0, z: 0 }, { providers: { plant: createPlantProvider() } })
    const resolver = createPlantResolver(THREE, { lod: 2, toSpec: defaultPlantSpec })
    const drawn = createUrbanThree(THREE, { document: fakeDocument, resolvers: { plant: resolver } }).draw(b.scene())
    const plants = placed(drawn.root, 'plant')
    expect(plants).toHaveLength(plan.plants.length)
    expect(plants.every((plant) => plant.children.length > 0)).toBe(true)
    plants.forEach((plant, index) => expect(plant.scale.x).toBeCloseTo(plan.plants[index]!.scale, 9))
    expect(plants[0].children[0].children.length).toBeGreaterThan(0)
    resolver.dispose?.()
  })

  it('the same scene draws the same plants', () => {
    const run = () => {
      const b = kit.builder({ seed: 7 })
      kit.neighbourhoods.get('rural').compose(b, { x: 0, z: 0 }, { providers: { plant: createPlantProvider() } })
      const drawn = createUrbanThree(THREE, { document: fakeDocument, resolvers: { plant: createPlantResolver(THREE, { lod: 2, toSpec: defaultPlantSpec }) } }).draw(b.scene())
      return placed(drawn.root, 'plant').map((plant) => [plant.userData.placement.id, plant.position.x, plant.children[0]?.children[0]?.geometry.attributes.position.count])
    }
    expect(run()).toEqual(run())
  })
})
