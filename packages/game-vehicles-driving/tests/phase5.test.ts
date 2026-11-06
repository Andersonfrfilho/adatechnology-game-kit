import { describe, expect, it } from 'vitest'

import { createSemiSimDriver, createVehicleControls, createVehicleStorage, createVehicleSystems, createWindshieldFog, GLOVEBOX, trunkFor } from '../src'
import type { ControlEvent, StorageAccess } from '../src'

const press = (controls: ReturnType<typeof createVehicleControls>, code: string): void => {
  controls.key(code, true)
  controls.key(code, false)
}
const hold = (controls: ReturnType<typeof createVehicleControls>, seconds: number, driver = createSemiSimDriver()): void => {
  const dt = 1 / 60
  for (let t = 0; t < seconds; t += dt) {
    driver.step(controls.input(dt, driver), dt)
    controls.after(driver, dt)
  }
}

describe('hotwire', () => {
  it('without the key the ignition refuses; the key held strips and joins the wires, the ignition goes live and the starter turns', () => {
    const events: ControlEvent[] = []
    const controls = createVehicleControls({ gears: 5, hasKey: false, hotwireSeconds: 4, onEvent: (e) => events.push(e) })
    press(controls, 'KeyI')
    expect(controls.state.ignition).toBe(false)
    expect(events).toContainEqual({ type: 'refused', command: 'ignition', reason: 'no_key' })
    controls.key('KeyI', true)
    hold(controls, 2)
    expect(controls.state.hotwire.progress).toBeGreaterThan(0.45)
    expect(controls.state.hotwire.progress).toBeLessThan(0.55)
    expect(controls.state.ignition).toBe(false)
    // let go halfway: the stripped wires stay stripped
    controls.key('KeyI', false)
    hold(controls, 1)
    expect(controls.state.hotwire.progress).toBeGreaterThan(0.45)
    controls.key('KeyI', true)
    let cranked = false
    const dt = 1 / 60
    const driver = createSemiSimDriver()
    for (let t = 0; t < 2.5; t += dt) {
      if (controls.input(dt, driver).start) cranked = true
      controls.after(driver, dt)
    }
    controls.key('KeyI', false)
    expect(controls.state.hotwire.done).toBe(true)
    expect(controls.state.ignition).toBe(true)
    expect(cranked).toBe(true)
    expect(events.filter((e) => e.type === 'hotwire').map((e) => (e as { stage: string }).stage)).toEqual(['started', 'joined'])
    // pulled apart the wires cut the ignition, joined again they make it live
    press(controls, 'KeyI')
    expect(controls.state.ignition).toBe(false)
    press(controls, 'KeyI')
    expect(controls.state.ignition).toBe(true)
  })

  it('an armed alarm goes off at the first touch of the wires; with the key the hotwire key is just the ignition', () => {
    const controls = createVehicleControls({ gears: 5, hasKey: false })
    controls.state.alarm = 'armed'
    controls.key('KeyI', true)
    hold(controls, 0.1)
    expect(controls.state.alarm).toBe('ringing')
    const keyed = createVehicleControls({ gears: 5 })
    keyed.key('KeyI', true)
    hold(keyed, 10)
    expect(keyed.state.ignition).toBe(true)
    expect(keyed.state.hotwire.progress).toBe(0)
  })
})

describe('siren and beacon', () => {
  it('an ordinary car has neither; an emergency vehicle cycles the siren wail, yelp, off and the beacon alternates its sides', () => {
    const events: ControlEvent[] = []
    const car = createVehicleControls({ gears: 5, onEvent: (e) => events.push(e) })
    press(car, 'Semicolon')
    press(car, 'Quote')
    expect(car.state.siren).toBe('off')
    expect(car.state.beacon).toBe(false)
    expect(events.filter((e) => e.type === 'refused').map((e) => (e as { reason: string }).reason)).toEqual(['no_siren', 'no_siren'])

    const police = createVehicleControls({ gears: 5, emergency: true, beaconHz: 2 })
    press(police, 'Semicolon')
    // the siren brings the lights with it
    expect(police.state.siren).toBe('wail')
    expect(police.state.beacon).toBe(true)
    const sides = new Set<number>()
    const dt = 1 / 60
    for (let t = 0; t < 1.2; t += dt) {
      police.input(dt)
      sides.add(police.state.beaconSide)
    }
    expect([...sides].sort()).toEqual([0, 1])
    press(police, 'Semicolon')
    expect(police.state.siren).toBe('yelp')
    press(police, 'Semicolon')
    expect(police.state.siren).toBe('off')
    expect(police.state.beacon).toBe(true)
    press(police, 'Semicolon')
    // the beacon off silences the siren too
    press(police, 'Quote')
    expect(police.state.beacon).toBe(false)
    expect(police.state.siren).toBe('off')
  })

  it('the siren and the beacon draw from the battery', () => {
    const police = createVehicleControls({ gears: 5, emergency: true })
    const quiet = createVehicleSystems({ charge: 0.5 })
    const loud = createVehicleSystems({ charge: 0.5 })
    const driver = { state: { engineOn: false, rpm: 0, u: 0 }, condition: {} }
    quiet.step({ driver, controls: police.state, throttle: 0, dt: 60 })
    press(police, 'Semicolon')
    loud.step({ driver, controls: police.state, throttle: 0, dt: 60 })
    expect(quiet.state.netW).toBe(0)
    expect(loud.state.netW).toBe(-170)
  })
})

describe('glovebox and trunk', () => {
  const shut: StorageAccess = { seated: false, frontDoorOpen: false, gloveboxOpen: false, lid: 0 }
  const seated: StorageAccess = { ...shut, seated: true, gloveboxOpen: true }
  const behind: StorageAccess = { ...shut, lid: 1 }

  it('the glovebox opens with its key and is reached from the seat or an open front door; the trunk with the lid up', () => {
    const controls = createVehicleControls({ gears: 5 })
    press(controls, 'Slash')
    expect(controls.state.glovebox).toBe(true)
    const storage = createVehicleStorage()
    const torch = { itemId: 'flashlight', count: 1, unitKg: 0.3 }
    expect(storage.put('glovebox', torch, shut)).toBe('shut')
    expect(storage.put('glovebox', torch, { ...shut, gloveboxOpen: true })).toBe('shut')
    expect(storage.put('glovebox', torch, { ...shut, gloveboxOpen: true, frontDoorOpen: true })).toBe('ok')
    expect(storage.put('trunk', torch, seated)).toBe('shut')
    expect(storage.put('trunk', { itemId: 'car_jack', count: 1, unitKg: 3.5 }, behind)).toBe('ok')
    expect(storage.take('trunk', 0, shut)).toBeNull()
    expect(storage.take('trunk', 0, behind)?.itemId).toBe('car_jack')
    expect(storage.contents('trunk')[0]).toBeNull()
  })

  it('holds up to its slots and its weight, joins stacks of the same item and adds up the load', () => {
    const storage = createVehicleStorage({ compartments: [GLOVEBOX, trunkFor(300)] })
    expect(trunkFor(300)).toEqual({ id: 'trunk', slots: 12, capacityKg: 75, access: 'lid' })
    expect(storage.put('glovebox', { itemId: 'battery_aa', count: 4, unitKg: 0.025 }, seated)).toBe('ok')
    expect(storage.put('glovebox', { itemId: 'battery_aa', count: 4, unitKg: 0.025 }, seated)).toBe('ok')
    expect(storage.contents('glovebox')[0]?.count).toBe(8)
    expect(storage.put('glovebox', { itemId: 'brick', count: 1, unitKg: 4 }, seated)).toBe('too_heavy')
    for (let i = 1; i < GLOVEBOX.slots; i++) expect(storage.put('glovebox', { itemId: `paper_${i}`, count: 1, unitKg: 0.05 }, seated)).toBe('ok')
    expect(storage.put('glovebox', { itemId: 'pen', count: 1, unitKg: 0.01 }, seated)).toBe('full')
    expect(storage.loadKg('glovebox')).toBeCloseTo(0.2 + 0.25, 6)
    // what was in it when found goes in shut; what does not fit comes back
    const left = storage.stock('trunk', [{ itemId: 'tyre', count: 1, unitKg: 12 }, { itemId: 'engine_block', count: 1, unitKg: 90 }])
    expect(left.map((s) => s.itemId)).toEqual(['engine_block'])
    expect(storage.loadKg()).toBeCloseTo(12.45, 6)
    storage.clear()
    expect(storage.loadKg()).toBe(0)
    expect(storage.put('bed', { itemId: 'x', count: 1, unitKg: 1 }, behind)).toBe('missing')
  })
})

describe('windshield fog', () => {
  const off = { on: false, demist: false }
  const run = (fog: ReturnType<typeof createWindshieldFog>, seconds: number, step: Omit<Parameters<ReturnType<typeof createWindshieldFog>['step']>[0], 'dt'>): void => {
    for (let t = 0; t < seconds; t += 0.1) fog.step({ ...step, dt: 0.1 })
  }

  it('a warm dry day never mists; a cold rainy day mists a shut car with people in it', () => {
    const dry = createWindshieldFog()
    run(dry, 300, { occupants: 2, outsideC: 25, cabinC: 25, climate: off })
    expect(dry.state.fog).toBe(0)
    const rainy = createWindshieldFog()
    run(rainy, 60, { occupants: 2, outsideC: 12, cabinC: 22, rain: 1, climate: off })
    expect(rainy.state.fog).toBeGreaterThan(0.9)
  })

  it('the demister clears it in seconds once the engine is warm, slower when cold; a window down clears it by itself', () => {
    const misted = { occupants: 2, outsideC: 12, cabinC: 22, rain: 1 }
    const warm = createWindshieldFog()
    run(warm, 60, { ...misted, climate: off })
    run(warm, 6, { ...misted, climate: { on: true, demist: true }, engineWarm: 1 })
    expect(warm.state.fog).toBe(0)
    const cold = createWindshieldFog()
    run(cold, 60, { ...misted, climate: off })
    run(cold, 3, { ...misted, climate: { on: true, demist: true }, engineWarm: 0 })
    expect(cold.state.fog).toBeGreaterThan(0.5)
    // a cold dry morning with four inside: shut it mists, the windows down let the cold, dry air in and it clears to a haze
    const morning = { occupants: 4, outsideC: 5, cabinC: 20 }
    const window = createWindshieldFog()
    run(window, 60, { ...morning, climate: off })
    expect(window.state.fog).toBeGreaterThan(0.9)
    run(window, 120, { ...morning, windows: 1, climate: off })
    expect(window.state.fog).toBeLessThan(0.5)
  })

  it('an empty car does not mist up on its own', () => {
    const empty = createWindshieldFog()
    run(empty, 600, { occupants: 0, outsideC: 12, cabinC: 14, rain: 1, climate: off })
    expect(empty.state.fog).toBeLessThan(0.25)
  })
})
