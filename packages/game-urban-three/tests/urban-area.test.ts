// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createTestRoom, demoItems } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'

import { createUrbanTestModule, loadUrbanTestModule, URBAN_AREA_ID } from '../src'
import { fakeDocument } from './fake-dom'

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
const options = (locale = 'pt-BR') => ({ locale, document: fakeDocument })

describe('urban test area', () => {
  it('passes the contract checks of the host and lays the poles, the grid, the terrain and the ten neighbourhoods', () => {
    const room = makeRoom()
    const module = createUrbanTestModule(options())
    const report = room.loadModule(module as never)
    expect(report.problems).toEqual([])
    expect(report.ok).toBe(true)
    expect(report.items).toEqual([...module.itemIds])
    expect(report.items).toHaveLength(17)
    expect(report.scenarios).toHaveLength(8)
    const laid = room.openArea(URBAN_AREA_ID)
    expect(laid.map((object) => object.itemId).sort()).toEqual([...module.itemIds].sort())
    for (let i = 0; i < 3; i++) room.update(1 / 60)
    expect(module.placed.size).toBe(17)
  })

  it('loads through loadUrbanTestModule and names the items in the room language', () => {
    const room = makeRoom('en')
    const report = loadUrbanTestModule(room, options('en')) as { problems: string[]; items: string[] }
    expect(report.problems).toEqual([])
    const grid = room.spawn('street_grid', [0, 0, -30], 0)
    expect(grid.itemId).toBe('street_grid')
    expect(room.spawned()).toHaveLength(1)
  })

  it('runs its eight scenarios green', async () => {
    const room = makeRoom()
    room.loadModule(createUrbanTestModule(options()) as never)
    const scenarios = (room as unknown as { scenarios: { id: string }[] }).scenarios.filter((scenario) => scenario.id.startsWith('urban_'))
    expect(scenarios).toHaveLength(8)
    const run = await room.runScenarios(scenarios as never)
    const bad = run.results.filter((result) => !result.ok).map((result) => `${result.id}: ${result.checks.filter((check) => !check.ok).map((check) => check.label).join('; ')}`)
    expect(bad).toEqual([])
    expect(run.passed).toBe(8)
  })

  it('draws a neighbourhood from the bench, redraws it when a setting changes, and takes it away', () => {
    const room = makeRoom()
    room.loadModule(createUrbanTestModule(options('en')) as never)
    const bench = room.bench(URBAN_AREA_ID)!
    expect(room.metrics().module.bench_objects).toBe(0)
    expect(bench.set('pattern', 'suburb')).toBe(true)
    expect(bench.act('compose')).toBe(true)
    const first = Number(room.metrics().module.bench_objects)
    expect(first).toBeGreaterThan(50)
    expect(Number(room.metrics().module.real_lights)).toBeGreaterThan(0)
    expect(bench.set('budget', 0)).toBe(true)
    expect(Number(room.metrics().module.real_lights)).toBe(0)
    expect(Number(room.metrics().module.light_budget_left)).toBeLessThan(0)
    expect(bench.set('lamps', 'none')).toBe(true)
    expect(Number(room.metrics().module.light_budget_left)).toBe(0)
    expect(bench.set('seed', 99)).toBe(true)
    expect(bench.set('pattern', 'mountain_resort')).toBe(true)
    expect(bench.set('providers', 'plants')).toBe(true)
    let plants = 0
    room.scene.traverse((o) => {
      if (o.userData.placement?.kind === 'plant' && o.children.length > 0) plants += 1
    })
    expect(plants).toBeGreaterThan(0)
    expect(bench.act('clear')).toBe(true)
    expect(Number(room.metrics().module.bench_objects)).toBe(0)
  })

  it('shows the boxes of the samples and the reach of the lights as layers', () => {
    const room = makeRoom()
    room.loadModule(createUrbanTestModule(options()) as never)
    room.openArea(URBAN_AREA_ID)
    const bench = room.bench(URBAN_AREA_ID)!
    expect(bench.setLayer('bounds', true)).toBe(true)
    expect(bench.setLayer('light_radius', true)).toBe(true)
    for (let i = 0; i < 3; i++) room.update(1 / 60)
    let helpers = 0
    room.scene.traverse((o) => {
      if (o.userData.helper) helpers += 1
    })
    expect(helpers).toBeGreaterThan(17)
    expect(bench.setLayer('bounds', false)).toBe(true)
    expect(bench.setLayer('light_radius', false)).toBe(true)
    for (let i = 0; i < 3; i++) room.update(1 / 60)
    let left = 0
    room.scene.traverse((o) => {
      if (o.userData.helper) left += 1
    })
    expect(left).toBe(0)
    const metrics = room.metrics().module
    expect(Number(metrics.samples)).toBe(17)
    expect(Number(metrics.draw_calls)).toBeGreaterThan(100)
    expect(Number(metrics.triangles)).toBeGreaterThan(1000)
    expect(Number(metrics.instances)).toBeGreaterThan(0)
  })

  it('shows the items a game adds to the catalogues', () => {
    const module = createUrbanTestModule({ ...options(), urban: { remove: { neighbourhoods: ['military'], poles: ['flood_tower'] } } })
    expect(module.itemIds).toHaveLength(15)
    expect(module.itemIds).not.toContain('military')
    expect(module.itemIds).not.toContain('pole_flood_tower')
  })
})
