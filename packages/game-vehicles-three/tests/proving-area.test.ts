// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import { createVehicleKit } from '@adatechnology/game-vehicles'
import { fleetProvingSubject, installFleet } from '@adatechnology/game-vehicles-fleet'

import { createProvingModule, PROVING_AREA_ID } from '../src'
import { fakeDocument } from './fake-dom'

vi.setConfig({ testTimeout: 600_000 })
afterEach(() => new Promise((resolve) => setImmediate(resolve)))

const stubRenderer = (): never => {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as never
}
const createKit = (three: unknown) => {
  const kit = createVehicleKit({ THREE: three as never, locale: 'en', document: fakeDocument as never })
  installFleet(kit)
  return kit
}
const setUp = () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false })
  const module = createProvingModule({ locale: 'en', createKit, vehicles: ['compact_hatch', 'city_bus'], subject: (id, mass) => fleetProvingSubject(id, mass ? { mass } : {}) })
  const report = room.loadModule(module as never)
  expect(report.problems).toEqual([])
  return { room, module, bench: room.bench(PROVING_AREA_ID)! }
}
const named = (room: ReturnType<typeof createTestRoom>, name: string) => room.scene.getObjectByName(name)

describe('proving ground area', () => {
  it('costs nothing until its area opens, then lays the track and the car', () => {
    const { room } = setUp()
    for (let i = 0; i < 5; i++) room.update(1 / 30)
    expect(named(room, 'proving_track')).toBeUndefined()
    room.openArea(PROVING_AREA_ID)
    room.update(1 / 30)
    expect(named(room, 'proving_track')).toBeDefined()
    expect(named(room, 'reverse_guides')).toBeDefined()
    room.dispose()
  })

  it('runs a measured test live on the track and writes it on the certificate', () => {
    const { room, module, bench } = setUp()
    room.openArea(PROVING_AREA_ID)
    room.update(1 / 30)
    bench.set('time_scale', 20)
    bench.act('run_test')
    for (let i = 0; i < 200 && module.certificate('compact_hatch')?.results[0]?.verdict === 'pending'; i++) room.update(1 / 30)
    const accel = module.certificate('compact_hatch')!.results.find((r) => r.test === 'accel_0_100')!
    expect(accel.verdict).toBe('pass')
    expect(accel.value).toBeGreaterThan(6)
    expect(room.log.entries().some((e) => e.type === 'proving_result')).toBe(true)
    room.dispose()
  })

  it('climbs the gears in order on the 0-100 run, logs each shift and shows the gear live on the board', () => {
    const { room, module, bench } = setUp()
    room.openArea(PROVING_AREA_ID)
    room.update(1 / 30)
    bench.set('time_scale', 1)
    bench.act('run_test')
    for (let i = 0; i < 900 && module.certificate('compact_hatch')?.results[0]?.verdict === 'pending'; i++) room.update(1 / 30)
    const shifts = room.log.entries().filter((e) => e.type === 'proving_shift').map((e) => e.data as { from: number; to: number; kmh: number; rpm: number })
    // the automatic goes up one gear at a time, each at a higher speed, the engine back under its peak after each shift
    expect(shifts.length).toBeGreaterThanOrEqual(2)
    shifts.forEach((s, i) => {
      expect(s.to).toBe(s.from + 1)
      if (i > 0) expect(s.kmh).toBeGreaterThan(shifts[i - 1]!.kmh)
    })
    expect(shifts[0]!.from).toBe(1)
    room.dispose()
  })

  it('certifies at once and takes the sign-off of a visual check (a refused one rejects the vehicle)', () => {
    const { room, module, bench } = setUp()
    room.openArea(PROVING_AREA_ID)
    room.update(1 / 30)
    bench.act('certify_now')
    expect(module.certificate('compact_hatch')!.results.filter((r) => r.kind === 'measured').every((r) => r.verdict === 'pass')).toBe(true)
    bench.set('visual_check', 'mirrors')
    bench.act('sign_ok')
    expect(module.certificate('compact_hatch')!.results.find((r) => r.test === 'mirrors')!.verdict).toBe('pass')
    bench.act('sign_fail')
    expect(module.certificate('compact_hatch')!.status).toBe('rejected')
    room.dispose()
  })

  it('lends the room its vehicle camera while open, adds the mirrors as extra views, and lets everything go when another area opens', () => {
    const { room, bench } = setUp()
    room.openArea(PROVING_AREA_ID)
    room.update(1 / 30)
    bench.setLayer('mirrors', true)
    bench.setLayer('reverse_camera', true)
    room.update(1 / 30)
    const track = named(room, 'proving_track')!
    const disposed: string[] = []
    track.traverse((o) => {
      const mesh = o as THREE.Mesh
      mesh.geometry?.addEventListener('dispose', () => disposed.push('geometry'))
    })
    room.openArea('nothing_here')
    room.update(1 / 30)
    expect(named(room, 'proving_track')).toBeUndefined()
    expect(named(room, 'reverse_guides')).toBeUndefined()
    expect(disposed.length).toBeGreaterThan(5)
    room.dispose()
  })

  it('lets the player drive: the keys go to the car (the room does not hear them), the key starts it, the lamps switch and F gets out', () => {
    const { room, module, bench } = setUp()
    room.openArea(PROVING_AREA_ID)
    room.update(1 / 30)
    const key = (code: string, down: boolean): void => void document.body.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true, cancelable: true }))
    const press = (code: string): void => {
      key(code, true)
      key(code, false)
    }
    // what the room hears: a listener on the window as the room's own (bubble phase)
    const heard: string[] = []
    const listen = (e: KeyboardEvent): void => void heard.push(e.code)
    window.addEventListener('keydown', listen)
    bench.act('drive')
    room.update(1 / 30)
    press('KeyI')
    key('KeyW', true)
    for (let i = 0; i < 90; i++) room.update(1 / 30)
    // the room never heard W: the car took it
    expect(heard).not.toContain('KeyW')
    expect(module.metrics!('en').find((m) => m.id === 'speed')!.read()).toBeGreaterThan(20)
    key('KeyW', false)
    // lamps: low beam takes two spots of the room's light budget
    const lit = (): number => room.lights?.stats().sources ?? -1
    const before = lit()
    press('KeyL')
    press('KeyL')
    room.update(1 / 30)
    if (before >= 0) expect(lit()).toBe(before + 2)
    expect(room.log.entries().some((e) => String(e.text).includes('low beam'))).toBe(true)
    press('KeyF')
    room.update(1 / 30)
    if (before >= 0) expect(lit()).toBe(before)
    // out of the car, W is the room's again
    key('KeyW', true)
    key('KeyW', false)
    expect(heard).toContain('KeyW')
    window.removeEventListener('keydown', listen)
    room.dispose()
  })
})
