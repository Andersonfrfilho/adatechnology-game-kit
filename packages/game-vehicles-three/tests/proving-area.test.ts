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

  it('keeps the room its own view until its area opens: loading the module and picking a camera on the bench take nothing over', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false })
    const module = createProvingModule({ locale: 'en', createKit, vehicles: ['compact_hatch'], subject: (id, mass) => fleetProvingSubject(id, mass ? { mass } : {}) })
    const views: Array<unknown | null> = []
    const attach = module.attach!.bind(module)
    // the host the room lends, with its main-view takeover recorded
    module.attach = (lent) =>
      attach(new Proxy(lent, { get: (target, key, receiver) => (key === 'setViewCamera' ? (camera: unknown | null) => (views.push(camera), target.setViewCamera?.(camera)) : Reflect.get(target, key, receiver)) }))
    room.loadModule(module as never)
    const bench = room.bench(PROVING_AREA_ID)!
    bench.set('camera', 'cockpit')
    room.update(1 / 30)
    expect(views.filter((camera) => camera !== null)).toEqual([])
    room.openArea(PROVING_AREA_ID)
    room.update(1 / 30)
    expect(views.at(-1)).not.toBeNull()
    room.openArea('nothing_here')
    room.update(1 / 30)
    expect(views.at(-1)).toBeNull()
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

  it('hotwires the car without the key, misting the glass in the cold rain until the demister clears it, and keeps items in the glovebox and the trunk', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false })
    const module = createProvingModule({
      locale: 'en',
      createKit,
      vehicles: ['compact_hatch', 'police_sedan'],
      subject: (id, mass) => fleetProvingSubject(id, mass ? { mass } : {}),
      stock: (compartment) => (compartment === 'glovebox' ? [{ itemId: 'car_key', count: 1, unitKg: 0.05 }] : [{ itemId: 'car_jack', count: 1, unitKg: 3.5 }]),
    })
    expect(room.loadModule(module as never).problems).toEqual([])
    const bench = room.bench(PROVING_AREA_ID)!
    room.openArea(PROVING_AREA_ID)
    room.update(1 / 30)
    const key = (code: string, down: boolean): void => void document.body.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true, cancelable: true }))
    const press = (code: string): void => {
      key(code, true)
      key(code, false)
    }
    const logged = (type: string): Array<{ text: string; data: Record<string, unknown> }> => room.log.entries().filter((e) => e.type === type) as never
    // no key: I refuses, held it strips and joins the wires and the engine turns over
    bench.act('take_key')
    room.update(1 / 30)
    press('KeyI')
    expect(room.log.entries().some((e) => String(e.text).includes('hold I to hotwire'))).toBe(true)
    key('KeyI', true)
    for (let i = 0; i < 9 * 30; i++) room.update(1 / 30)
    key('KeyI', false)
    expect(logged('proving_system').map((e) => e.data.stage).filter(Boolean)).toEqual(['started', 'joined'])
    for (let i = 0; i < 30; i++) room.update(1 / 30)
    expect(module.metrics!('en').find((m) => m.id === 'rpm')!.read()).toBeGreaterThan(500)

    // cold rain: the glass mists up inside, the mist shows on the panes; the demister clears it
    const film = (): number => {
      let shown = 0
      room.scene.traverse((o) => {
        if (o.name === 'windshield_mist' && o.visible) shown++
      })
      return shown
    }
    expect(film()).toBe(0)
    const fogNow = (): number => Number(module.metrics!('en').find((m) => m.id === 'fog')!.read())
    bench.act('cold_rain')
    for (let i = 0; i < 90 * 30 && fogNow() < 80; i++) room.update(1 / 30)
    expect(fogNow()).toBeGreaterThan(80)
    expect(film()).toBeGreaterThan(0)
    expect(room.log.entries().some((e) => String(e.text).includes('misted up inside'))).toBe(true)
    press('Equal')
    for (let i = 0; i < 40 * 30 && fogNow() > 0; i++) room.update(1 / 30)
    expect(fogNow()).toBe(0)
    expect(film()).toBe(0)

    // the glovebox is shut until its lid opens (/); the trunk until the lid goes up (6)
    bench.act('glovebox_contents')
    expect(logged('proving_storage').at(-1)!.text).toContain('Glovebox shut')
    press('Slash')
    bench.act('glovebox_contents')
    expect(logged('proving_storage').at(-1)!.text).toContain('car_key')
    bench.act('trunk_contents')
    expect(logged('proving_storage').at(-1)!.text).toContain('Trunk shut')
    press('Digit6')
    for (let i = 0; i < 60; i++) room.update(1 / 30)
    bench.act('trunk_contents')
    expect(logged('proving_storage').at(-1)!.text).toContain('car_jack')
    bench.act('take_from_trunk')
    expect(logged('proving_storage').at(-1)!.data).toMatchObject({ item: 'car_jack' })
    bench.act('trunk_contents')
    expect(logged('proving_storage').at(-1)!.text).toContain('Trunk: empty')

    // an ordinary hatch has no siren; the police sedan's light bar flashes its two halves in turn and the siren draws from the battery
    press('Semicolon')
    expect(room.log.entries().some((e) => String(e.text).includes('no siren'))).toBe(true)
    press('KeyF')
    room.update(1 / 30)
    bench.set('vehicle', 'police_sedan')
    room.update(1 / 30)
    bench.act('drive')
    room.update(1 / 30)
    const glow = (side: number): number => {
      let sum = 0
      room.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
        if (o.userData.lamp === 'beacon' && o.userData.beaconSide === side && m && !Array.isArray(m)) sum += m.emissiveIntensity
      })
      return sum
    }
    expect(glow(0) + glow(1)).toBeGreaterThan(0)
    press('Semicolon')
    expect(room.log.entries().some((e) => String(e.text).includes('Siren: wail'))).toBe(true)
    const seen = new Set<string>()
    for (let i = 0; i < 30; i++) {
      room.update(1 / 30)
      seen.add(glow(0) > glow(1) ? 'red' : 'blue')
    }
    expect([...seen].sort()).toEqual(['blue', 'red'])
    press('KeyF')
    room.update(1 / 30)
    room.dispose()
  })
})
