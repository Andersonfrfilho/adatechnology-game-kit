/**
 * The player at the wheel of the proving ground's vehicle: the keyboard read into the vehicle controls of `game-vehicles-driving` (pedals, wheel, gearbox,
 * handbrake, ignition, drive mode, lamps, indicators, wipers, belt, horn, alarm and radio), the semi driver stepped with them, the lamps of the built vehicle
 * switched (`createVehicleLamps`) and the cabin sounds asked of the host. The driving keys are taken before the room sees them (capture phase), so W does
 * not also walk and F gets the driver out instead of the room's own use. Everything is removed by `stop`.
 */
import type { ModuleHost } from '@adatechnology/game-contracts'
import { createSemiSimDriver, createVehicleControls } from '@adatechnology/game-vehicles-driving'
import type { ControlEvent, SemiDriver, VehicleControls } from '@adatechnology/game-vehicles-driving'
import { subjectSpec } from '@adatechnology/game-vehicles-proving'
import type { ProvingSubject } from '@adatechnology/game-vehicles-proving'

import type { BuiltVehicle } from '../../build'
import { createVehicleLamps } from '../../lamps'
import type { VehicleLamps } from '../../lamps'

/** The cabin's sounds; an empty name stays silent (the starter, when the host's engine sound turns the key itself). */
export type CockpitSounds = { horn: string; blinker: string; starter: string; alarm: string; chirp: string; wiper: string; chime: string; radio: string }
export const DEFAULT_COCKPIT_SOUNDS: CockpitSounds = { horn: 'horn', blinker: 'blinker_tick', starter: 'starter_crank', alarm: 'car_alarm', chirp: 'alarm_chirp', wiper: 'wiper_swish', chime: 'seatbelt_chime', radio: 'radio_static' }

export interface Cockpit {
  readonly driver: SemiDriver
  readonly controls: VehicleControls
  readonly lamps: VehicleLamps
  /** The gas this step, 0..1 (what the engine's sound loads by). */
  readonly throttle: number
  step(dt: number): void
  stop(): void
}

export function createCockpit(o: {
  THREE: Parameters<typeof createVehicleLamps>[0]
  host: ModuleHost
  built: BuiltVehicle
  subject: ProvingSubject
  sounds?: Partial<CockpitSounds>
  place: [number, number, number]
  onEvent?: (event: ControlEvent) => void
  onExit: () => void
}): Cockpit {
  const sounds = { ...DEFAULT_COCKPIT_SOUNDS, ...o.sounds }
  const spec = subjectSpec(o.subject)
  const driver = createSemiSimDriver(spec)
  driver.place(o.place[0], o.place[1], o.place[2])
  const lamps = createVehicleLamps(o.THREE, o.built, { lights: o.host.lights, owner: 'proving-ground' })
  const audio = o.host.audio
  const at = (): [number, number, number] => [o.built.group.position.x, 1, o.built.group.position.z]
  const play = (sound: string, volume = 1): void => void audio?.play?.({ sound, position: at(), volume })
  let alarmAgain = 0
  let hornAgain = 0
  let wipeAgain = 0
  let chimeAgain = 0
  let radioAgain = 0
  let exitAsked = false
  let gas = 0

  const controls = createVehicleControls({
    gears: spec.gears?.length ?? 5,
    fourWheelDrive: !!o.subject.body.fourWheelDrive,
    fogLamps: lamps.has.fog,
    onEvent: (event) => {
      if (event.type === 'command') {
        if (event.command === 'ignition' && event.state.ignition && sounds.starter) play(sounds.starter)
        if (event.command === 'ignition' && !event.state.ignition) driver.state.engineOn = false
        if (event.command === 'alarm' && event.state.alarm === 'armed') play(sounds.chirp)
        if (event.command === 'alarm') alarmAgain = 0
        if (event.command === 'radio' || event.command === 'radio_source') radioAgain = 0
        if (event.command === 'exit') exitAsked = true
      }
      o.onEvent?.(event)
    },
  })
  // the driver gets in with the engine off: the key (I) or the gas pedal starts it
  driver.state.engineOn = false

  const target: Window | null = typeof window !== 'undefined' ? window : null
  const down = (e: KeyboardEvent): void => {
    if (!controls.key(e.code, true)) return
    // the room listens on the window too: a driving key stops here
    e.stopImmediatePropagation()
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault()
  }
  const up = (e: KeyboardEvent): void => {
    if (controls.key(e.code, false)) e.stopImmediatePropagation()
  }
  const blur = (): void => controls.release()
  target?.addEventListener('keydown', down, true)
  target?.addEventListener('keyup', up, true)
  target?.addEventListener('blur', blur)

  return {
    driver,
    controls,
    lamps,
    get throttle() {
      return gas
    },
    step(dt) {
      const input = controls.input(dt, driver)
      gas = input.throttle
      driver.step(input, dt)
      controls.after(driver, dt)
      const s = controls.state
      lamps.set({
        mode: s.lamps.mode,
        fog: s.lamps.fog,
        interior: s.lamps.interior,
        brake: s.brakeLights,
        reverse: s.reverseLights,
        left: s.blinkOn && (s.indicator === 'left' || s.indicator === 'hazard'),
        right: s.blinkOn && (s.indicator === 'right' || s.indicator === 'hazard'),
      })
      if (s.tick) play(sounds.blinker, 0.8)
      // the horn's note is 0.6 s: held, it sounds again before the last one ends
      if (s.horn && (hornAgain -= dt) <= 0) {
        play(sounds.horn)
        hornAgain = 0.5
      } else if (!s.horn) hornAgain = 0
      if (s.alarm === 'ringing' && (alarmAgain -= dt) <= 0) {
        play(sounds.alarm)
        alarmAgain = 2.9
      }
      if (s.wipers !== 'off' && (wipeAgain -= dt) <= 0) {
        play(sounds.wiper, 0.7)
        wipeAgain = s.wipers === 'fast' ? 0.6 : 1.4
      }
      // moving without the belt: the chime, every few seconds
      const kmh = Math.abs(driver.state.u) * 3.6
      if (!s.seatbelt && s.ignition && kmh > 10 && (chimeAgain -= dt) <= 0) {
        play(sounds.chime, 0.6)
        chimeAgain = 6
      }
      // the radio: the station's hiss, or the tape's (the music is a pack of its own)
      if (s.radio.on && (radioAgain -= dt) <= 0) {
        play(sounds.radio, s.radio.source === 'tape' ? 0.25 : 0.45)
        radioAgain = 0.55
      }
      if (exitAsked) {
        exitAsked = false
        o.onExit()
      }
    },
    stop() {
      target?.removeEventListener('keydown', down, true)
      target?.removeEventListener('keyup', up, true)
      target?.removeEventListener('blur', blur)
      controls.release()
      lamps.dispose()
    },
  }
}
