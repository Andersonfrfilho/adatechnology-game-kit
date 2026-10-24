// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three160'
import { createTestRoom, demoItems } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'

import * as GameVegetation from '@adatechnology/game-vegetation'
import * as GameVegetationAdapter from '@adatechnology/game-vegetation/three'
import * as GameVegetationSpecies from '@adatechnology/game-vegetation-species'

import { WAY, createNursery } from '../src'
import { VEGETATION_AREA_ID, VEGETATION_ITEM_IDS, VEGETATION_SCENARIO_IDS, createVegetationTestModule, loadVegetationTestModule } from '../src'

vi.setConfig({ testTimeout: 600_000 })
afterEach(() => new Promise((resolve) => setImmediate(resolve)))

const stubRenderer = (): never => {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as never
}
const makeRoom = (locale = 'pt-BR'): TestRoom => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return createTestRoom({ THREE, container, locale, catalog: demoItems(locale), renderer: stubRenderer(), ui: false })
}

describe('vegetation test area', () => {
  it('passes the contract checks of the host and lays the 18 plants', () => {
    const room = makeRoom()
    const module = createVegetationTestModule({ locale: 'pt-BR' })
    const report = room.loadModule(module as never)
    expect(report.problems).toEqual([])
    expect(report.ok).toBe(true)
    expect(report.items).toEqual([...VEGETATION_ITEM_IDS])
    expect(report.scenarios).toEqual([...VEGETATION_SCENARIO_IDS])
    const placed = room.openArea(VEGETATION_AREA_ID)
    expect(placed.map((object) => object.itemId).sort()).toEqual([...VEGETATION_ITEM_IDS].sort())
    for (let i = 0; i < 5; i++) room.update(1 / 60)
    expect(module.placed.size).toBe(18)
  })

  it('loads through loadVegetationTestModule and names the plants in the room language', () => {
    const room = makeRoom('en')
    const report = loadVegetationTestModule(room, { locale: 'en' }) as { problems: string[]; items: string[] }
    expect(report.problems).toEqual([])
    const mango = room.spawn('mango_young_15', [0, 0, -6], 0)
    expect(mango.itemId).toBe('mango_young_15')
    expect(room.spawned()).toHaveLength(1)
  })

  it('plants the nursery lot from the bench, bends plants with the walker, shows the layers and reads the metrics', () => {
    const room = makeRoom()
    room.loadModule(createVegetationTestModule({ locale: 'en' }) as never)
    room.openArea(VEGETATION_AREA_ID)
    const bench = room.bench(VEGETATION_AREA_ID)!
    for (let i = 0; i < 3; i++) room.update(1 / 60)
    expect(room.metrics().module.lot_plants).toBe(0)
    expect(bench.set('seed', 7)).toBe(true)
    expect(bench.set('quality', 'game')).toBe(true)
    expect(bench.set('lod', '1')).toBe(true)
    expect(bench.set('condition', 'dry')).toBe(true)
    expect(bench.set('season', 'autumn')).toBe(true)
    expect(bench.set('wind', 0.8)).toBe(true)
    expect(bench.act('plant_lot')).toBe(true)
    const lot = room.metrics().module
    expect(Number(lot.lot_plants)).toBeGreaterThan(20)
    expect(Number(lot.lot_triangles)).toBeGreaterThan(1000)
    expect(Number(lot.lot_colliders)).toBeGreaterThan(0)
    // changing a setting re-plants the lot that stands
    const first = Number(lot.lot_triangles)
    expect(bench.set('seed', 8)).toBe(true)
    expect(Number(room.metrics().module.lot_triangles)).not.toBe(first)
    // the walker walks and bends: its first waypoint is the corner by the gate
    expect(bench.act('toggle_walker')).toBe(true)
    for (let i = 0; i < 120; i++) room.update(1 / 60)
    const nursery = room.scene.getObjectByName('nursery') as { userData: Record<string, unknown> }
    expect(nursery).toBeTruthy()
    // layers
    expect(bench.setLayer('colliders', true)).toBe(true)
    expect(bench.setLayer('piece_boxes', true)).toBe(true)
    expect(bench.setLayer('wood_axes', true)).toBe(true)
    for (let i = 0; i < 3; i++) room.update(1 / 60)
    let helpers = 0
    room.scene.traverse((o) => {
      if (o.userData.helper) helpers += 1
    })
    expect(helpers).toBeGreaterThan(100)
    expect(bench.setLayer('piece_boxes', false)).toBe(true)
    expect(bench.setLayer('wood_axes', false)).toBe(true)
    expect(bench.setLayer('colliders', false)).toBe(true)
    for (let i = 0; i < 3; i++) room.update(1 / 60)
    let left = 0
    room.scene.traverse((o) => {
      if (o.userData.helper) left += 1
    })
    expect(left).toBe(0)
    const metrics = room.metrics().module
    expect(Number(metrics.plants)).toBe(18)
    expect(Number(metrics.pieces)).toBeGreaterThan(100)
    expect(Number(metrics.triangles)).toBeGreaterThan(1000)
    expect(Number(metrics.draw_calls)).toBeGreaterThan(100)
    // take the lot away
    expect(bench.act('clear_lot')).toBe(true)
    expect(room.scene.getObjectByName('nursery')).toBeUndefined()
    expect(Number(room.metrics().module.lot_plants)).toBe(0)
  })

  it('shows the wood axes with the radius, length and axis of the SDK', () => {
    const room = makeRoom()
    room.loadModule(createVegetationTestModule({ locale: 'en' }) as never)
    const tree = room.spawn('mango_tree', [0, 0, -6], 0)
    const bench = room.bench(VEGETATION_AREA_ID)!
    expect(bench.setLayer('wood_axes', true)).toBe(true)
    for (let i = 0; i < 3; i++) room.update(1 / 60)
    let lines = 0
    tree.root.traverse((o) => {
      if (o.userData.helper && (o as { isLine?: boolean }).isLine) lines += 1
    })
    // one line for the trunk and one for each branch
    expect(lines).toBeGreaterThanOrEqual(4)
  })

  it('the walker crosses the lot along its route, stays out of the house and bends the plants', () => {
    const sdk = { ...GameVegetation, ...GameVegetationAdapter } as never as typeof GameVegetation & typeof GameVegetationAdapter
    const materials = sdk.createVegetationMaterials(THREE as never)
    const actors: { x: number; z: number; radius: number }[][] = []
    const spy = { ...materials, setActors: (list: { x: number; z: number; radius: number }[]) => actors.push(list.map((a) => ({ ...a }))) }
    const nursery = createNursery(sdk, GameVegetationSpecies as never, THREE, spy as never, new THREE.Group(), [10, 20])
    nursery.plant({ seed: 3, quality: 'game', lod: 1, condition: 'healthy', season: 'spring' })
    nursery.setWalker(true)
    let farthest = 0
    for (let i = 0; i < 60 * 90; i++) {
      nursery.step(1 / 60)
      const { x, z } = nursery.position
      expect(x > 2.1 && x < 9.9 && z > 6.1 && z < 13.4, 'inside the house').toBe(false)
      farthest = Math.max(farthest, Math.hypot(x - WAY[0]![0], z - WAY[0]![1]))
    }
    expect(farthest).toBeGreaterThan(6)
    const last = actors[actors.length - 1]![0]!
    // the actor is lent to the shader in world space: the plot corner (10, 20) plus the walker
    expect(last.x).toBeCloseTo(10 + nursery.position.x, 6)
    expect(last.z).toBeCloseTo(20 + nursery.position.z, 6)
    nursery.setWalker(false)
    expect(actors[actors.length - 1]![0]!.radius).toBe(0)
  })
})
