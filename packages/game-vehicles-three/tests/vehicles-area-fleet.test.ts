// @vitest-environment happy-dom
import { defaultVehicleFleet } from '@adatechnology/game-kit-defaults'
import { describe, expect, it, vi } from 'vitest'

import { VEHICLES_AREA_ID, VEHICLE_SCENARIO_IDS, loadVehiclesTestModule } from '../src'
import { fakeDocument } from './fake-dom'
import { breathe, roomOf, roomWithVehicles } from './vehicles-room'

// The whole fleet of the page: each test builds the 10 vehicles several times, and lets the worker answer vitest between the long stretches.
vi.setConfig({ testTimeout: 600_000 })

describe('vehicles test area, the whole fleet', () => {
  it('learns the room three.js by itself and brings the door, hood and trunk clips', async () => {
    const room = roomOf('en')
    const report = loadVehiclesTestModule(room, { fleet: defaultVehicleFleet(), locale: 'en', document: fakeDocument as never }) as { problems: string[]; items: string[] }
    expect(report.problems).toEqual([])
    expect(report.items).toHaveLength(10)
    await breathe()
    room.openArea(VEHICLES_AREA_ID)
    const sedan = room.spawn('sedan', [0, 0, -7], 0)
    room.update(1 / 60)
    expect(room.playAnimation('open_hood', sedan.objectId)).toBe(true)
    expect(room.playAnimation('open_nothing', sedan.objectId)).toBe(false)
  })

  it('passes the contract checks of the host and lays the 8 vehicles of the Frota test and the 2 burnt wrecks', async () => {
    const { room, module } = roomWithVehicles()
    await breathe()
    const placed = room.openArea(VEHICLES_AREA_ID)
    expect(placed.map((object) => object.itemId)).toEqual(['hatch', 'sedan', 'pickup', 'sport_bike', 'box_truck', 'city_bus', 'battle_tank', 'sedan_burnt', 'hatch_burnt', 'attack_helicopter'])
    for (let i = 0; i < 5; i++) room.update(1 / 60)
    expect(module.placed.size).toBe(10)
  })

  it('the bench paints by seed, shows the boxes and the axes, drives the lane and measures against DIMS', async () => {
    const { room } = roomWithVehicles()
    await breathe()
    room.openArea(VEHICLES_AREA_ID)
    await breathe()
    const bench = room.bench(VEHICLES_AREA_ID)!
    for (let i = 0; i < 3; i++) room.update(1 / 60)
    expect(bench.set('paint_by_seed', true)).toBe(true)
    expect(bench.set('color_seed', 7)).toBe(true)
    expect(bench.set('palette', 'civil')).toBe(true)
    expect(bench.act('repaint')).toBe(true)
    expect(bench.setLayer('damageables', true)).toBe(true)
    expect(bench.setLayer('zones', true)).toBe(true)
    expect(bench.setLayer('axes', true)).toBe(true)
    for (let i = 0; i < 3; i++) room.update(1 / 60)
    const metrics = room.metrics().module
    expect(metrics.vehicles).toBe(10)
    expect(Number(metrics.triangles)).toBeGreaterThan(100_000)
    expect(Number(metrics.metal)).toBeGreaterThan(8)
    expect(Number(metrics.glass)).toBeGreaterThan(8)
    expect(Number(metrics.fuel)).toBeGreaterThan(0)
    // DIMS are the fused build's: the full build keeps pieces under 3 cm (a mirror stalk, an antenna)
    expect(Number(metrics.size_error_mm)).toBeLessThanOrEqual(60)
    for (const mode of ['arcade', 'semi']) {
      await breathe()
      expect(bench.set('driving', mode)).toBe(true)
      expect(bench.act('drive_lane')).toBe(true)
      for (let i = 0; i < 600; i++) room.update(1 / 60)
      expect(Number(room.metrics().module.lane)).toBeGreaterThan(10)
      expect(bench.act('clear_lane')).toBe(true)
    }
  })

  it('every scenario passes', async () => {
    const { room } = roomWithVehicles('en')
    await breathe()
    room.openArea(VEHICLES_AREA_ID)
    await breathe()
    const report = await room.runScenarios(room.scenarios.filter((scenario) => VEHICLE_SCENARIO_IDS.includes(scenario.id)))
    const failed = report.results.filter((result) => !result.ok).map((result) => `${result.id}: ${result.checks.filter((check) => !check.ok).map((check) => check.label).join('; ')}`)
    expect(report.results).toHaveLength(VEHICLE_SCENARIO_IDS.length)
    expect(failed).toEqual([])
  })
})
