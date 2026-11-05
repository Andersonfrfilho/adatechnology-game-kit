import { describe, expect, it } from 'vitest'

import { bumperDistance, createSemiSimDriver, createVehicleControls, createVehicleSystems, ejectionOf, parkingBeepInterval, tractionLimit } from '../src'
import type { SemiEvent, SystemsEvent } from '../src'

const DT = 1 / 60
const setUp = (options: Parameters<typeof createVehicleControls>[0] = { gears: 5 }, systemsOptions: Parameters<typeof createVehicleSystems>[0] = {}) => {
  const driver = createSemiSimDriver()
  const systems = createVehicleSystems(systemsOptions)
  const controls = createVehicleControls({ canCrank: systems.canCrank, onCrank: systems.crank, powerLimit: systems.powerLimit, ...options })
  const events: Array<SemiEvent | SystemsEvent> = []
  const run = (seconds: number, radiator = 1): void => {
    for (let t = 0; t < seconds; t += DT) {
      const input = controls.input(DT, driver)
      events.push(...driver.step(input, DT).events)
      controls.after(driver, DT)
      events.push(...systems.step({ driver, controls: controls.state, throttle: input.throttle, dt: DT, radiator }))
    }
  }
  const press = (code: string): void => {
    controls.key(code, true)
    controls.key(code, false)
  }
  return { driver, systems, controls, events, run, press }
}

describe('car systems', () => {
  it('a flat battery does not crank; a jump start does, and the alternator charges while the engine runs', () => {
    const { driver, systems, controls, events, run, press } = setUp({ gears: 5 }, { charge: 0.2 })
    const refused: string[] = []
    const c2 = createVehicleControls({ gears: 5, canCrank: systems.canCrank, onEvent: (e) => e.type === 'refused' && refused.push(e.reason) })
    c2.command('ignition')
    c2.input(DT, driver)
    expect(refused).toEqual(['battery_flat'])
    systems.charge(0.5)
    press('KeyI')
    run(0.5)
    expect(driver.state.engineOn).toBe(true)
    const before = systems.state.charge
    run(20)
    expect(systems.state.charge).toBeGreaterThan(before)
    expect(controls.state.cranking).toBe(false)
    expect(events.filter((e) => e.type === 'battery_flat')).toEqual([])
  })

  it('lamps and radio left on with the engine off drain the battery until it will not crank', () => {
    const { systems, controls, events, run } = setUp({ gears: 5 }, { charge: 0.3, batteryWh: 2 })
    controls.command('lights')
    controls.command('lights')
    controls.command('radio')
    expect(controls.state.lamps.mode).toBe('low')
    run(60)
    expect(systems.state.charge).toBeLessThan(0.25)
    expect(systems.canCrank()).toBe(false)
    expect(events.some((e) => e.type === 'battery_flat')).toBe(true)
  })

  it('the thermostat holds the coolant near 90 °C; a punctured radiator overheats, cuts the power and seizes the engine', () => {
    const { driver, systems, events, run, press, controls } = setUp()
    press('KeyI')
    controls.key('KeyW', true)
    run(300)
    expect(systems.state.coolantC).toBeGreaterThan(80)
    expect(systems.state.coolantC).toBeLessThan(100)
    expect(systems.powerLimit()).toBe(1)
    run(900, 0.05)
    expect(events.some((e) => e.type === 'overheating')).toBe(true)
    expect(events.some((e) => e.type === 'seized')).toBe(true)
    expect(driver.state.engineOn).toBe(false)
    expect(systems.canCrank()).toBe(false)
  })

  it('a flat tyre swaps for the one spare, and a second flat finds none', () => {
    const { driver, systems } = setUp()
    driver.condition = { tyres: [0, 1, 1, 1] }
    expect(systems.fitSpare(driver, 0)).toEqual({ type: 'spare_fitted', wheel: 0 })
    expect(driver.condition.tyres?.[0]).toBe(1)
    expect(systems.fitSpare(driver, 1)).toEqual({ type: 'no_spare' })
  })

  it('runs out of fuel and stops; refuelled, the key starts it again', () => {
    const { driver, events, run, press, controls } = setUp()
    press('KeyI')
    driver.state.fuel = 0.02
    controls.key('KeyW', true)
    run(30)
    expect(events.some((e) => e.type === 'out_of_fuel')).toBe(true)
    expect(driver.state.engineOn).toBe(false)
    driver.refuel(20)
    press('KeyI')
    press('KeyI')
    run(0.2)
    expect(driver.state.engineOn).toBe(true)
  })
})

describe('driver aids', () => {
  it('stalls a manual when the clutch comes up in first without gas, and pulls away when the gas comes with the clutch', () => {
    const { driver, controls, events, run, press } = setUp({ gears: 5, clutchPedal: true })
    press('KeyM')
    expect(controls.state.gear).toBe(0)
    press('KeyI')
    run(0.3)
    controls.key('KeyC', true)
    run(0.5)
    press('KeyE')
    controls.key('KeyC', false)
    run(1)
    expect(events.filter((e) => e.type === 'stall')).toHaveLength(1)
    expect(driver.state.engineOn).toBe(false)
    // clutch down, key back, gas, and the clutch let up slowly
    controls.key('KeyC', true)
    run(0.5)
    press('KeyI')
    press('KeyI')
    run(0.3)
    controls.key('KeyW', true)
    run(0.5)
    controls.key('KeyC', false)
    run(3)
    expect(events.filter((e) => e.type === 'stall')).toHaveLength(1)
    expect(driver.state.u * 3.6).toBeGreaterThan(15)
  })

  it('holds the cruise speed on its own, and the brake cancels it', () => {
    const { driver, controls, events, run, press } = setUp()
    press('KeyI')
    controls.key('KeyW', true)
    run(6)
    controls.key('KeyW', false)
    press('Digit0')
    expect(controls.state.cruise.on).toBe(true)
    const set = controls.state.cruise.speed
    run(20)
    expect(Math.abs(driver.state.u - set)).toBeLessThan(1.5)
    controls.key('KeyS', true)
    run(0.3)
    expect(controls.state.cruise.on).toBe(false)
    expect(events.length).toBeGreaterThanOrEqual(0)
  })

  it('refuses cruise control under 30 km/h', () => {
    const reasons: string[] = []
    const driver = createSemiSimDriver()
    const controls = createVehicleControls({ gears: 5, running: true, onEvent: (e) => e.type === 'refused' && reasons.push(e.reason) })
    controls.input(DT, driver)
    controls.after(driver, DT)
    controls.command('cruise')
    expect(reasons).toEqual(['too_slow'])
  })

  it('traction control cuts the torque only while a driven wheel slides', () => {
    expect(tractionLimit([0.5, 0.6])).toBe(1)
    expect(tractionLimit([1, 0.5])).toBeCloseTo(0.35)
    expect(tractionLimit([0.985])).toBeGreaterThan(0.35)
  })

  it('economy shifts earlier than sport, and ABS and the profile reach the driver', () => {
    const shiftAt = (profile: 'eco' | 'sport'): number => {
      const { driver, controls, events, run, press } = setUp()
      while (controls.state.profile !== profile) press('Digit7')
      press('KeyI')
      controls.key('KeyW', true)
      for (let i = 0; i < 600 && !events.some((e) => e.type === 'shift' && e.gear === 2); i++) run(DT)
      return driver.state.u
    }
    expect(shiftAt('eco')).toBeLessThan(shiftAt('sport'))
    const { driver, controls, run, press } = setUp()
    press('Digit9')
    run(DT)
    expect(controls.state.abs).toBe(false)
    expect(driver.spec.abs).toBe(false)
  })

  it('flashes the high beam while X is held, washes on Z, and the wipers go through intermittent', () => {
    const { controls, run, press } = setUp()
    controls.key('KeyX', true)
    controls.key('KeyZ', true)
    run(DT)
    expect(controls.state.lamps.flash).toBe(true)
    expect(controls.state.washer).toBe(true)
    controls.key('KeyX', false)
    controls.key('KeyZ', false)
    run(DT)
    expect(controls.state.lamps.flash).toBe(false)
    press('KeyO')
    expect(controls.state.wipers).toBe('intermittent')
    press('Equal')
    expect(controls.state.climate).toEqual({ on: true, demist: true })
  })
})

describe('parking sensors and ejection', () => {
  it('beeps faster as the obstacle behind comes close, continuous at the end, quiet far away or off to the side', () => {
    const behind = (gap: number, side = 0): number => bumperDistance({ x: 0, z: 0, heading: [0, 1], length: 4, width: 1.8, forward: false, obstacles: [[side, -2 - gap]] })
    expect(behind(1)).toBeCloseTo(1)
    expect(parkingBeepInterval(behind(2))).toBeNull()
    expect(parkingBeepInterval(behind(1.2))).toBeGreaterThan(parkingBeepInterval(behind(0.6)) as number)
    expect(parkingBeepInterval(behind(0.2))).toBe(0)
    expect(behind(0.5, 3)).toBe(Infinity)
  })

  it('throws an unbelted occupant through the windshield past 30 km/h of crash, out of the side window on a side impact, and never a belted one', () => {
    const frontal = { before: { u: 20, w: 0 }, after: { u: 0, w: 0 } }
    expect(ejectionOf(frontal, true)).toBeNull()
    expect(ejectionOf(frontal, false)?.exit).toBe('windshield')
    expect(ejectionOf(frontal, false)?.velocity[0]).toBeCloseTo(16)
    expect(ejectionOf({ before: { u: 5, w: 0 }, after: { u: 0, w: 0 } }, false)).toBeNull()
    expect(ejectionOf({ before: { u: 0, w: 8 }, after: { u: 0, w: 0 } }, false)?.exit).toBe('right_window')
    expect(ejectionOf({ before: { u: 3, w: 0 }, after: { u: 0, w: 0 }, rolled: true }, false)).not.toBeNull()
  })
})
