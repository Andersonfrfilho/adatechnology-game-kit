import { describe, expect, it } from 'vitest'

import { createSemiSimDriver, createVehicleControls } from '../src'
import type { ControlEvent } from '../src'

const drive = (seconds: number, controls: ReturnType<typeof createVehicleControls>, driver: ReturnType<typeof createSemiSimDriver>): void => {
  const dt = 1 / 60
  for (let t = 0; t < seconds; t += dt) {
    driver.step(controls.input(dt, driver), dt)
    controls.after(driver, dt)
  }
}

describe('vehicle controls', () => {
  it('drives forward on W, reverses from a stop on S, and the key off keeps the gas from the engine', () => {
    const driver = createSemiSimDriver()
    const controls = createVehicleControls({ gears: 5 })
    controls.key('KeyW', true)
    drive(3, controls, driver)
    // the key is off: the gas pedal does not reach the engine
    expect(driver.state.u).toBeLessThan(0.5)
    controls.key('KeyI', true)
    controls.key('KeyI', false)
    expect(controls.state.ignition).toBe(true)
    drive(3, controls, driver)
    expect(driver.state.u * 3.6).toBeGreaterThan(30)
    controls.key('KeyW', false)
    controls.key('KeyS', true)
    drive(10, controls, driver)
    expect(driver.state.u).toBeLessThan(-0.5)
    expect(controls.state.reverseLights).toBe(true)
  })

  it('shifts by hand in manual: E up, Q down through neutral to reverse, and the gas drives the reverse gear backwards', () => {
    const driver = createSemiSimDriver()
    const events: ControlEvent[] = []
    const controls = createVehicleControls({ gears: 5, running: true, onEvent: (e) => events.push(e) })
    const press = (code: string): void => {
      controls.key(code, true)
      controls.key(code, false)
    }
    press('KeyE')
    expect(controls.state.gear).toBe(1) // automatic: E does nothing
    press('KeyM')
    expect(controls.state.gearbox).toBe('manual')
    press('KeyE')
    press('KeyE')
    expect(controls.state.gear).toBe(3)
    press('KeyQ')
    press('KeyQ')
    press('KeyQ')
    press('KeyQ')
    expect(controls.state.gear).toBe(-1)
    controls.key('KeyW', true)
    drive(3, controls, driver)
    expect(driver.state.gear).toBe(-1)
    expect(driver.state.u).toBeLessThan(-0.5)
    expect(events.some((e) => e.type === 'command' && e.command === 'gearbox')).toBe(true)
  })

  it('holds the handbrake on Space and leaves it pulled on P', () => {
    const controls = createVehicleControls({ gears: 5, running: true })
    controls.key('Space', true)
    expect(controls.input(1 / 60).handbrake).toBe(true)
    controls.key('Space', false)
    expect(controls.input(1 / 60).handbrake).toBe(false)
    controls.key('KeyP', true)
    controls.key('KeyP', false)
    expect(controls.input(1 / 60).handbrake).toBe(true)
    expect(controls.state.brakeLights).toBe(true)
  })

  it('offers 4x4 only to a vehicle that has it, and the automatic 4x4 brings the front axle in when the rear slips', () => {
    const plain = createVehicleControls({ gears: 5 })
    const refused: ControlEvent[] = []
    const plainEvents = createVehicleControls({ gears: 5, onEvent: (e) => refused.push(e) })
    plainEvents.command('drive_mode')
    expect(plain.state.driveMode).toBe('4x2')
    expect(refused[0]).toMatchObject({ type: 'refused', reason: 'no_four_wheel_drive' })

    const controls = createVehicleControls({ gears: 5, fourWheelDrive: true })
    expect(controls.state.driveMode).toBe('auto')
    const driver = { spec: { fourWheelDrive: false }, state: { u: 5, gear: 1, slip: [0, 0, 0.6, 0.6], engineOn: true } }
    controls.after(driver, 1 / 60)
    expect(controls.state.fourWheelEngaged).toBe(true)
    expect(driver.spec.fourWheelDrive).toBe(true)
    driver.state.slip = [0, 0, 0, 0]
    controls.after(driver, 3)
    expect(driver.spec.fourWheelDrive).toBe(false)
    controls.command('drive_mode') // auto -> 4x2
    controls.command('drive_mode') // 4x2 -> 4x4
    controls.after(driver, 1 / 60)
    expect(controls.state.driveMode).toBe('4x4')
    expect(driver.spec.fourWheelDrive).toBe(true)
  })

  it('cycles the lamps, the high beam, fog only when the vehicle has it, and the cabin light', () => {
    const controls = createVehicleControls({ gears: 5, fogLamps: false })
    controls.command('lights')
    expect(controls.state.lamps.mode).toBe('position')
    controls.command('lights')
    expect(controls.state.lamps.mode).toBe('low')
    controls.command('high_beam')
    expect(controls.state.lamps.mode).toBe('high')
    controls.command('high_beam')
    expect(controls.state.lamps.mode).toBe('low')
    controls.command('fog_lights')
    expect(controls.state.lamps.fog).toBe(false)
    controls.command('interior_light')
    expect(controls.state.lamps.interior).toBe(true)
  })

  it('blinks the indicators with a relay tick, cancels them after the turn and keeps the hazard on', () => {
    const controls = createVehicleControls({ gears: 5, running: true })
    controls.command('indicator_left')
    let ticks = 0
    let lit = 0
    for (let i = 0; i < 120; i++) {
      controls.input(1 / 60)
      if (controls.state.tick) ticks++
      if (controls.state.blinkOn) lit++
    }
    // 1.5 blinks a second for 2 s: 6 changes of the relay, lit about half the time
    expect(ticks).toBeGreaterThanOrEqual(5)
    expect(lit).toBeGreaterThan(40)
    expect(lit).toBeLessThan(80)
    // turn left, then back to the centre: the stalk drops
    controls.key('KeyA', true)
    for (let i = 0; i < 60; i++) controls.input(1 / 60)
    controls.key('KeyA', false)
    for (let i = 0; i < 60; i++) controls.input(1 / 60)
    expect(controls.state.indicator).toBe('off')
    controls.command('hazard')
    controls.command('indicator_right')
    expect(controls.state.indicator).toBe('hazard')
  })

  it('arms the alarm, rings it and turning the key disarms it; the radio, wipers and belt switch', () => {
    const controls = createVehicleControls({ gears: 5 })
    controls.command('alarm')
    expect(controls.state.alarm).toBe('armed')
    controls.command('alarm')
    expect(controls.state.alarm).toBe('ringing')
    controls.command('ignition')
    expect(controls.state.alarm).toBe('off')
    controls.command('radio')
    controls.command('radio_source')
    expect(controls.state.radio).toEqual({ on: true, source: 'tape' })
    controls.command('wipers')
    controls.command('wipers')
    expect(controls.state.wipers).toBe('fast')
    controls.command('seatbelt')
    expect(controls.state.seatbelt).toBe(true)
  })

  it('takes only its own keys, and every key can be changed', () => {
    const controls = createVehicleControls({ gears: 5, keys: { horn: ['KeyZ'] } })
    expect(controls.key('KeyX', true)).toBe(false)
    expect(controls.key('KeyZ', true)).toBe(true)
    controls.input(1 / 60)
    expect(controls.state.horn).toBe(true)
    expect(controls.key('KeyH', true)).toBe(false)
  })
})
