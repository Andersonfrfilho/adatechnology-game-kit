// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'

import { defaultEffectIds, defaultSoundIds, VEHICLES_AREA_ID, VEHICLE_SCENARIO_IDS, createVehiclesTestModule, loadVehiclesTestModule } from '../src'
import { fakeDocument } from './fake-dom'

// the vehicles are long synchronous builds, and the scenarios run seconds of simulation
vi.setConfig({ testTimeout: 600_000 })
afterEach(() => new Promise((resolve) => setImmediate(resolve)))

const stubRenderer = (): never => {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as never
}

const roomWithVehicles = (locale = 'pt-BR'): { room: TestRoom; module: ReturnType<typeof createVehiclesTestModule>; played: string[] } => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({ THREE, container, locale, catalog: [], renderer: stubRenderer(), ui: false })
  const played: string[] = []
  const module = createVehiclesTestModule({ locale, document: fakeDocument as never, three: THREE })
  const report = room.loadModule(module as never)
  expect(report.problems).toEqual([])
  return { room, module, played }
}

describe('vehicles test area', () => {
  it('asks the room engine for the horn and the engine loop by id (the crash sound waits for a crash), from the library bank of game-audio', () => {
    const { room } = roomWithVehicles('en')
    for (const id of [defaultSoundIds.horn, defaultSoundIds.crash]) expect([id, room.audio!.registry.sound(id) !== undefined]).toEqual([id, true])
    expect(room.audio!.registry.loop(defaultSoundIds.engine)).toBeDefined()
    const played: string[] = []
    const loops: string[] = []
    const audio = room.audio!
    const play = audio.play.bind(audio)
    audio.play = ((sound: string, ...rest: unknown[]) => (played.push(sound), (play as (...a: unknown[]) => unknown)(sound, ...rest))) as never
    const loop = audio.loop.bind(audio)
    audio.loop = ((sound: string, ...rest: unknown[]) => (loops.push(sound), (loop as (...a: unknown[]) => unknown)(sound, ...rest))) as never
    const bench = room.bench(VEHICLES_AREA_ID)
    room.openArea(VEHICLES_AREA_ID)
    bench?.act('honk')
    bench?.act('drive_lane')
    for (let i = 0; i < 600; i++) room.update(1 / 30)
    expect(played).toContain(defaultSoundIds.horn)
    expect(loops).toContain(defaultSoundIds.engine)
  })

  it('asks the room effects for ids the game-vfx catalogue knows (no particle code of its own)', () => {
    const { room } = roomWithVehicles('en')
    const known = new Set([...room.vfx.catalog(), ...room.vfx.effectIds()])
    for (const [event, id] of Object.entries(defaultEffectIds)) expect([event, known.has(id)]).toEqual([event, true])
    expect(room.vfx.play(defaultEffectIds.sparks, [0, 1, 0])).not.toBeNull()
    expect(room.vfx.explosion(defaultEffectIds.explode, [0, 0.6, 4])).not.toBeNull()
  })

  it('learns the room three.js by itself and brings the door, hood and trunk clips', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false })
    const report = loadVehiclesTestModule(room, { locale: 'en', document: fakeDocument as never }) as { problems: string[]; items: string[] }
    expect(report.problems).toEqual([])
    expect(report.items).toHaveLength(8)
    room.openArea(VEHICLES_AREA_ID)
    const sedan = room.spawn('sedan', [0, 0, -7], 0)
    room.update(1 / 60)
    expect(room.playAnimation('open_hood', sedan.objectId)).toBe(true)
    expect(room.playAnimation('open_nothing', sedan.objectId)).toBe(false)
  })

  it('passes the contract checks of the host and lays the 8 vehicles of the Frota test', () => {
    const { room, module } = roomWithVehicles()
    const placed = room.openArea(VEHICLES_AREA_ID)
    expect(placed.map((object) => object.itemId)).toEqual(['hatch', 'sedan', 'pickup', 'sport_bike', 'box_truck', 'city_bus', 'battle_tank', 'attack_helicopter'])
    for (let i = 0; i < 5; i++) room.update(1 / 60)
    expect(module.placed.size).toBe(8)
  })

  it('the bench paints by seed, shows the boxes and the axes, drives the lane and measures against DIMS', () => {
    const { room } = roomWithVehicles()
    room.openArea(VEHICLES_AREA_ID)
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
    expect(metrics.vehicles).toBe(8)
    expect(Number(metrics.triangles)).toBeGreaterThan(100_000)
    expect(Number(metrics.metal)).toBeGreaterThan(8)
    expect(Number(metrics.glass)).toBeGreaterThan(8)
    expect(Number(metrics.fuel)).toBeGreaterThan(0)
    // DIMS are the fused build's: the full build keeps pieces under 3 cm (a mirror stalk, an antenna)
    expect(Number(metrics.size_error_mm)).toBeLessThanOrEqual(60)
    for (const mode of ['arcade', 'semi']) {
      expect(bench.set('driving', mode)).toBe(true)
      expect(bench.act('drive_lane')).toBe(true)
      for (let i = 0; i < 600; i++) room.update(1 / 60)
      expect(Number(room.metrics().module.lane)).toBeGreaterThan(10)
      expect(bench.act('clear_lane')).toBe(true)
    }
  })

  it('has the 11 scenarios of the page and the 2 of the drivers, in both languages', async () => {
    for (const locale of ['pt-BR', 'en']) {
      const { room } = roomWithVehicles(locale)
      room.openArea(VEHICLES_AREA_ID)
      const mine = room.scenarios.filter((scenario) => VEHICLE_SCENARIO_IDS.includes(scenario.id))
      expect(mine.map((scenario) => scenario.id)).toEqual([...VEHICLE_SCENARIO_IDS])
      expect(mine.every((scenario) => scenario.name.startsWith(locale === 'en' ? 'Vehicles' : 'Veículos'))).toBe(true)
    }
  })

  it('every scenario passes', async () => {
    const { room } = roomWithVehicles('en')
    room.openArea(VEHICLES_AREA_ID)
    const report = await room.runScenarios(room.scenarios.filter((scenario) => VEHICLE_SCENARIO_IDS.includes(scenario.id)))
    const failed = report.results.filter((result) => !result.ok).map((result) => `${result.id}: ${result.checks.filter((check) => !check.ok).map((check) => check.label).join('; ')}`)
    expect(report.results).toHaveLength(VEHICLE_SCENARIO_IDS.length)
    expect(failed).toEqual([])
  })
})
