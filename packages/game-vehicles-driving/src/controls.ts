/**
 * The controls of a vehicle someone drives: pedals (the clutch too), wheel, gearbox (automatic or manual), handbrake (held or pulled), ignition and
 * starter, drive mode (4x2, 4x4, automatic 4x4), drive profile (eco, normal, sport), traction control, ABS, cruise control, lamps (position, low,
 * high, flash, fog, interior), wipers and washer, climate and demister, horn, alarm and radio. It turns key codes into a `SemiInput` for the semi driver and keeps
 * what the cabin shows; it draws and plays nothing (an adapter reads `state` for the lamps and the sounds). Every key is an option.
 */
import { cruiseThrottle, DEFAULT_CRUISE, DRIVE_PROFILES, tractionLimit } from './driving-aids'
import type { DriveProfile } from './driving-aids'
import type { SemiInput } from './semi/types'

export type ControlCommand =
  | 'ignition'
  | 'gearbox'
  | 'gear_up'
  | 'gear_down'
  | 'parking_brake'
  | 'drive_mode'
  | 'lights'
  | 'high_beam'
  | 'fog_lights'
  | 'interior_light'
  | 'alarm'
  | 'radio'
  | 'radio_source'
  | 'radio_track'
  | 'exit'
  | 'indicator_left'
  | 'indicator_right'
  | 'hazard'
  | 'wipers'
  | 'seatbelt'
  | 'drive_profile'
  | 'traction_control'
  | 'abs'
  | 'cruise'
  | 'climate'
  | 'demist'

export type ControlKeyMap = {
  readonly throttle: readonly string[]
  readonly brake: readonly string[]
  readonly left: readonly string[]
  readonly right: readonly string[]
  readonly handbrake: readonly string[]
  readonly horn: readonly string[]
  readonly clutch: readonly string[]
  /** Flashes the high beam while held. */
  readonly flash: readonly string[]
  readonly washer: readonly string[]
} & { readonly [command in ControlCommand]: readonly string[] }

/** Keys of a keyboard (`KeyboardEvent.code`). The host keeps them from its own bindings while someone drives. */
export const DEFAULT_CONTROL_KEYS: ControlKeyMap = {
  throttle: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  handbrake: ['Space'],
  horn: ['KeyH'],
  clutch: ['KeyC'],
  flash: ['KeyX'],
  washer: ['KeyZ'],
  ignition: ['KeyI'],
  gearbox: ['KeyM'],
  gear_up: ['KeyE'],
  gear_down: ['KeyQ'],
  parking_brake: ['KeyP'],
  drive_mode: ['KeyG'],
  lights: ['KeyL'],
  high_beam: ['KeyK'],
  fog_lights: ['KeyN'],
  interior_light: ['KeyU'],
  alarm: ['KeyY'],
  radio: ['KeyR'],
  radio_source: ['KeyT'],
  radio_track: ['BracketRight'],
  exit: ['KeyF'],
  indicator_left: ['Comma'],
  indicator_right: ['Period'],
  hazard: ['KeyB'],
  wipers: ['KeyO'],
  seatbelt: ['KeyJ'],
  drive_profile: ['Digit7'],
  traction_control: ['Digit8'],
  abs: ['Digit9'],
  cruise: ['Digit0'],
  climate: ['Minus'],
  demist: ['Equal'],
}
const HELD_KEYS = ['throttle', 'brake', 'left', 'right', 'handbrake', 'horn', 'clutch', 'flash', 'washer']

export type Gearbox = 'automatic' | 'manual'
export type DriveMode = '4x2' | '4x4' | 'auto'
export type LampMode = 'off' | 'position' | 'low' | 'high'
export type AlarmState = 'off' | 'armed' | 'ringing'
export type RadioSource = 'radio' | 'tape'
export type Indicator = 'off' | 'left' | 'right' | 'hazard'
export type Wipers = 'off' | 'intermittent' | 'slow' | 'fast'

export interface ControlState {
  ignition: boolean
  gearbox: Gearbox
  /** The gear the driver chose (manual): -1 reverse, 0 neutral, 1.. forward. */
  gear: number
  /** Pulled and left pulled (P); Space holds it only while pressed. */
  parkingBrake: boolean
  driveMode: DriveMode
  /** The front axle drives now (4x4, or automatic 4x4 that felt the rear slip). */
  fourWheelEngaged: boolean
  /** `flash`: the high beam lit while the flash key is held, over any mode. */
  lamps: { mode: LampMode; fog: boolean; interior: boolean; flash: boolean }
  /** What the rear lamps show this step: brake (pedal or handbrake) and reversing. */
  brakeLights: boolean
  reverseLights: boolean
  horn: boolean
  alarm: AlarmState
  /** `track`: the station or the song on the tape, 0-based (`radioTracks` of them). */
  radio: { on: boolean; source: RadioSource; track: number }
  indicator: Indicator
  /** The indicator lamps are lit this instant (they blink at `blinkHz`); `tick` is true on the step the relay clicks. */
  blinkOn: boolean
  tick: boolean
  wipers: Wipers
  /** The washer squirts while its key is held (the wipers sweep with it). */
  washer: boolean
  seatbelt: boolean
  /** Clutch pedal, 0 up to 1 down (manual gearbox). */
  clutch: number
  profile: DriveProfile
  tractionControl: boolean
  abs: boolean
  /** Cruise control: the speed it holds, m/s. */
  cruise: { on: boolean; speed: number }
  climate: { on: boolean; demist: boolean }
  /** The starter turns this step. */
  cranking: boolean
}

export type ControlEvent =
  | { type: 'command'; command: ControlCommand; state: ControlState }
  | { type: 'refused'; command: ControlCommand; reason: 'no_four_wheel_drive' | 'no_fog_lamps' | 'ignition_off' | 'battery_flat' | 'too_slow' }
  | { type: 'cruise_cancelled' }

export interface VehicleControlOptions {
  /** Forward gears of the gearbox. */
  gears: number
  /** The vehicle can drive both axles (4x4 and automatic 4x4 are offered). */
  fourWheelDrive?: boolean
  /** The vehicle has fog lamps. Default true. */
  fogLamps?: boolean
  keys?: Partial<ControlKeyMap>
  gearbox?: Gearbox
  /** Automatic 4x4: the front axle comes in above this slip of a driven wheel (1 = sliding) and goes out after `releaseSeconds` below it. */
  autoFourWheel?: { slip: number; releaseSeconds: number }
  /** The engine runs from the start (a vehicle the player gets into with the engine on). Default false: the key turns it on (I) or the gas pedal starts it. */
  running?: boolean
  /** Blinks a second of the indicators (default 1.5, the 90 a minute of the road codes). */
  blinkHz?: number
  /** The steering wheel coming back this far (0..1 of the lock) after a turn cancels the indicator, as the column does. Default 0.15. */
  indicatorCancel?: number
  /** Stations or songs the radio steps through (`radio_track`). Default 3. */
  radioTracks?: number
  /** The driver works the clutch (C) in manual: released in gear too slowly or without gas, the engine stalls. Default false (the clutch is automated). */
  clutchPedal?: boolean
  /** The starter can turn the engine over (a battery with charge); asked at every crank. Default always. */
  canCrank?: () => boolean
  /** A crank happened (takes the battery's energy). */
  onCrank?: () => void
  /** Share of the torque the engine gives besides the aids (an overheated engine). Default 1. */
  powerLimit?: () => number
  onEvent?: (event: ControlEvent) => void
}

/** What the controls read of the driver each step, and the one thing they change on it (which axles drive). */
export interface ControlledDriver {
  readonly spec: { fourWheelDrive: boolean; abs?: boolean; upshiftFraction?: number; downshiftFraction?: number; readonly wheels?: ReadonlyArray<{ drive?: boolean }> }
  readonly state: { u: number; gear: number; slip: readonly number[]; engineOn: boolean }
}

export interface VehicleControls {
  /** A key went down or up. True when it is a driving key (the host keeps it from its own bindings). */
  key(code: string, down: boolean): boolean
  /** Runs a command as its key would (a button of a panel). */
  command(command: ControlCommand): void
  /** The input for this step, pedals and wheel eased over `dt` seconds. */
  input(dt: number, driver?: ControlledDriver): SemiInput
  /** After the driver stepped: the automatic 4x4 watches the slip, the ignition the engine. */
  after(driver: ControlledDriver, dt: number): void
  readonly state: ControlState
  readonly keys: ControlKeyMap
  /** Lets go of every key (the window lost focus, the driver got out). */
  release(): void
}

export function createVehicleControls(options: VehicleControlOptions): VehicleControls {
  const keys: ControlKeyMap = { ...DEFAULT_CONTROL_KEYS, ...options.keys }
  const auto4 = options.autoFourWheel ?? { slip: 0.18, releaseSeconds: 2 }
  const hasFog = options.fogLamps !== false
  const held = new Set<string>()
  const any = (codes: readonly string[]): boolean => codes.some((c) => held.has(c))
  const commandOf = new Map<string, ControlCommand>()
  for (const [command, codes] of Object.entries(keys)) if (!HELD_KEYS.includes(command)) for (const code of codes) commandOf.set(code, command as ControlCommand)
  const driving = new Set<string>(Object.values(keys).flat())

  const state: ControlState = {
    ignition: !!options.running,
    gearbox: options.gearbox ?? 'automatic',
    gear: 1,
    parkingBrake: false,
    driveMode: options.fourWheelDrive ? 'auto' : '4x2',
    fourWheelEngaged: false,
    lamps: { mode: 'off', fog: false, interior: false, flash: false },
    brakeLights: false,
    reverseLights: false,
    horn: false,
    alarm: 'off',
    radio: { on: false, source: 'radio', track: 0 },
    indicator: 'off',
    blinkOn: false,
    tick: false,
    wipers: 'off',
    washer: false,
    seatbelt: false,
    clutch: 0,
    profile: 'normal',
    tractionControl: true,
    abs: true,
    cruise: { on: false, speed: 0 },
    climate: { on: false, demist: false },
    cranking: false,
  }
  let crankAsked = false
  let lastSpeed = 0
  let engineRunning = !!options.running
  const blinkHz = options.blinkHz ?? 1.5
  const cancelAt = options.indicatorCancel ?? 0.15
  let blink = 0
  let turned = 0
  let throttle = 0
  let brake = 0
  let steer = 0
  let calm = 0
  const emit = (event: ControlEvent): void => options.onEvent?.(event)
  const LAMPS: readonly LampMode[] = ['off', 'position', 'low']
  const MODES: readonly DriveMode[] = ['4x2', '4x4', 'auto']
  const WIPERS: readonly Wipers[] = ['off', 'intermittent', 'slow', 'fast']
  const PROFILES: readonly DriveProfile[] = ['eco', 'normal', 'sport']

  const command = (c: ControlCommand): void => {
    switch (c) {
      case 'ignition':
        state.ignition = !state.ignition
        // the driver turning the key disarms the alarm and cranks; turning it off leaves the radio playing on the battery
        if (state.ignition && state.alarm !== 'off') state.alarm = 'off'
        if (state.ignition) crankAsked = true
        else state.cruise.on = false
        break
      case 'gearbox':
        state.gearbox = state.gearbox === 'automatic' ? 'manual' : 'automatic'
        // with a clutch to work, a manual starts in neutral (in gear with the clutch up it would stall at once)
        state.gear = options.clutchPedal && state.gearbox === 'manual' && Math.abs(lastSpeed) < 0.5 ? 0 : Math.max(1, state.gear)
        break
      case 'gear_up':
      case 'gear_down':
        if (state.gearbox !== 'manual') return
        state.gear = Math.max(-1, Math.min(options.gears, state.gear + (c === 'gear_up' ? 1 : -1)))
        break
      case 'parking_brake':
        state.parkingBrake = !state.parkingBrake
        break
      case 'drive_mode': {
        if (!options.fourWheelDrive) return emit({ type: 'refused', command: c, reason: 'no_four_wheel_drive' })
        state.driveMode = MODES[(MODES.indexOf(state.driveMode) + 1) % MODES.length] as DriveMode
        state.fourWheelEngaged = state.driveMode === '4x4'
        break
      }
      case 'lights':
        // off → position → low → off; high beam is its own switch over the low beam
        state.lamps.mode = state.lamps.mode === 'high' ? 'off' : (LAMPS[(LAMPS.indexOf(state.lamps.mode) + 1) % LAMPS.length] as LampMode)
        break
      case 'high_beam':
        state.lamps.mode = state.lamps.mode === 'high' ? 'low' : 'high'
        break
      case 'fog_lights':
        if (!hasFog) return emit({ type: 'refused', command: c, reason: 'no_fog_lamps' })
        state.lamps.fog = !state.lamps.fog
        // fog lamps go with the position lamps at least
        if (state.lamps.fog && state.lamps.mode === 'off') state.lamps.mode = 'position'
        break
      case 'interior_light':
        state.lamps.interior = !state.lamps.interior
        break
      case 'alarm':
        // armed → ringing (someone forced it) → off; off → armed
        state.alarm = state.alarm === 'off' ? 'armed' : state.alarm === 'armed' ? 'ringing' : 'off'
        break
      case 'radio':
        state.radio.on = !state.radio.on
        break
      case 'radio_source':
        state.radio.source = state.radio.source === 'radio' ? 'tape' : 'radio'
        break
      case 'radio_track':
        state.radio.track = (state.radio.track + 1) % Math.max(1, options.radioTracks ?? 3)
        break
      case 'exit':
        break
      case 'indicator_left':
      case 'indicator_right': {
        const side = c === 'indicator_left' ? 'left' : 'right'
        // the hazard switch wins over the stalk; the stalk pushed again the same way puts it back
        if (state.indicator === 'hazard') return
        state.indicator = state.indicator === side ? 'off' : side
        turned = 0
        blink = 0
        break
      }
      case 'hazard':
        state.indicator = state.indicator === 'hazard' ? 'off' : 'hazard'
        blink = 0
        break
      case 'wipers':
        state.wipers = WIPERS[(WIPERS.indexOf(state.wipers) + 1) % WIPERS.length] as Wipers
        break
      case 'drive_profile':
        state.profile = PROFILES[(PROFILES.indexOf(state.profile) + 1) % PROFILES.length] as DriveProfile
        break
      case 'traction_control':
        state.tractionControl = !state.tractionControl
        break
      case 'abs':
        state.abs = !state.abs
        break
      case 'cruise':
        if (state.cruise.on) state.cruise.on = false
        else if (!engineRunning) return emit({ type: 'refused', command: c, reason: 'ignition_off' })
        else if (lastSpeed < DEFAULT_CRUISE.minSpeed) return emit({ type: 'refused', command: c, reason: 'too_slow' })
        else state.cruise = { on: true, speed: lastSpeed }
        break
      case 'climate':
        state.climate.on = !state.climate.on
        if (!state.climate.on) state.climate.demist = false
        break
      case 'demist':
        // the air conditioning dries the air: the demister runs it
        state.climate.demist = !state.climate.demist
        if (state.climate.demist) state.climate.on = true
        break
      case 'seatbelt':
        state.seatbelt = !state.seatbelt
        break
    }
    emit({ type: 'command', command: c, state })
  }

  const ease = (from: number, to: number, rate: number, dt: number): number => from + Math.sign(to - from) * Math.min(Math.abs(to - from), rate * dt)

  return {
    keys,
    state,
    key(code, down) {
      if (!driving.has(code)) return false
      const was = held.has(code)
      if (down) held.add(code)
      else held.delete(code)
      // a command runs on the press, not while the key repeats
      const c = commandOf.get(code)
      if (c && down && !was) command(c)
      return true
    },
    command,
    input(dt, driver) {
      const gas = any(keys.throttle) ? 1 : 0
      const stop = any(keys.brake) ? 1 : 0
      const wheel = (any(keys.left) ? 1 : 0) - (any(keys.right) ? 1 : 0)
      // pedals in a quarter of a second and out faster; the wheel turns in a third of a second and comes back to the centre faster still
      throttle = ease(throttle, gas, gas > throttle ? 4 : 8, dt)
      brake = ease(brake, stop, stop > brake ? 6 : 10, dt)
      steer = ease(steer, wheel, wheel !== 0 && Math.sign(wheel) === Math.sign(steer || wheel) ? 3 : 6, dt)
      const handbrake = state.parkingBrake || any(keys.handbrake)
      // the indicators blink on the relay; a turn the way they point and the wheel back near the centre cancels them
      state.tick = false
      if (state.indicator !== 'off') {
        const before = Math.floor(blink * blinkHz * 2)
        blink += dt
        const now = Math.floor(blink * blinkHz * 2)
        state.blinkOn = now % 2 === 0
        state.tick = now !== before
        if (state.indicator !== 'hazard') {
          const way = state.indicator === 'left' ? steer : -steer
          if (way > 0.5) turned = 1
          else if (turned && way < cancelAt) state.indicator = 'off'
        }
      } else state.blinkOn = false
      state.horn = any(keys.horn)
      state.lamps.flash = any(keys.flash)
      state.washer = any(keys.washer)
      // the clutch goes down fast and comes up as slowly as a foot lets it, so it bites on the way
      state.clutch = ease(state.clutch, any(keys.clutch) ? 1 : 0, any(keys.clutch) ? 8 : 2.5, dt)
      const speed = driver?.state.u ?? 0
      lastSpeed = speed
      // the brake, the clutch or the handbrake cancel cruise control
      if (state.cruise.on && (brake > 0.05 || state.clutch > 0.5 || handbrake)) {
        state.cruise.on = false
        emit({ type: 'cruise_cancelled' })
      }
      // the key off: no gas reaches the engine; the brakes still work
      const tune = DRIVE_PROFILES[state.profile]
      let gasNow = state.ignition ? throttle * tune.throttle : 0
      if (state.cruise.on && state.ignition) gasNow = Math.max(gasNow, cruiseThrottle(state.cruise.speed, speed))
      // the starter: the key turned, or (automatic, key on) the gas pressed after the engine died with the car still
      const gasStart = state.gearbox === 'automatic' && state.ignition && !engineRunning && throttle > 0 && Math.abs(speed) < 0.5
      state.cranking = false
      if (crankAsked || gasStart) {
        crankAsked = false
        if (options.canCrank && !options.canCrank()) emit({ type: 'refused', command: 'ignition', reason: 'battery_flat' })
        else {
          state.cranking = true
          options.onCrank?.()
        }
      }
      const driven = (driver?.state.slip ?? []).filter((_, i) => driver?.spec.wheels?.[i]?.drive ?? true)
      const powerLimit = (state.tractionControl ? tractionLimit(driven) : 1) * (options.powerLimit?.() ?? 1)
      const reversing = state.gearbox === 'manual' ? state.gear < 0 : (driver?.state.gear ?? 1) < 0
      state.reverseLights = reversing
      state.brakeLights = handbrake || (reversing ? gasNow > 0.05 && speed < -0.3 : brake > 0.05)
      const common = { steer, handbrake, horn: state.horn, start: state.cranking, powerLimit }
      if (state.gearbox === 'automatic') return { ...common, throttle: gasNow, brake }
      // manual: the gas drives the chosen gear either way (backwards in reverse) and the brake only brakes; the driver reads the pedals against the direction of travel
      const pedals = state.gear < 0 ? { throttle: brake, brake: gasNow } : { throttle: gasNow, brake }
      return { ...common, ...pedals, gear: state.gear, ...(options.clutchPedal ? { clutch: state.clutch } : {}) }
    },
    after(driver, dt) {
      if (!state.ignition && driver.state.engineOn) (driver.state as { engineOn: boolean }).engineOn = false
      engineRunning = driver.state.engineOn
      if (!engineRunning) state.cruise.on = false
      // the aids reach the driver: ABS on the brakes, the profile on the shift points
      const spec = driver.spec as { abs?: boolean; upshiftFraction?: number; downshiftFraction?: number }
      spec.abs = state.abs
      if (spec.upshiftFraction != null) {
        spec.upshiftFraction = DRIVE_PROFILES[state.profile].upshift
        spec.downshiftFraction = DRIVE_PROFILES[state.profile].downshift
      }
      if (state.driveMode === 'auto' && options.fourWheelDrive) {
        const slip = Math.max(0, ...driver.state.slip)
        if (slip > auto4.slip) {
          state.fourWheelEngaged = true
          calm = 0
        } else if (state.fourWheelEngaged && (calm += dt) > auto4.releaseSeconds) state.fourWheelEngaged = false
      } else state.fourWheelEngaged = state.driveMode === '4x4'
      driver.spec.fourWheelDrive = !!options.fourWheelDrive && state.fourWheelEngaged
    },
    release() {
      held.clear()
      throttle = brake = steer = 0
      state.horn = false
      state.lamps.flash = false
      state.washer = false
      state.clutch = 0
      state.cruise.on = false
    },
  }
}
