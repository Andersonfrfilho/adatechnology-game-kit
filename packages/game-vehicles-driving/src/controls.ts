/**
 * The controls of a vehicle someone drives: pedals, wheel, gearbox (automatic or manual), handbrake (held or pulled), ignition, drive mode (4x2, 4x4,
 * automatic 4x4), lamps (position, low, high, fog, interior), horn, alarm and radio. It turns key codes into a `SemiInput` for the semi driver and keeps
 * what the cabin shows; it draws and plays nothing (an adapter reads `state` for the lamps and the sounds). Every key is an option.
 */
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
  | 'exit'
  | 'indicator_left'
  | 'indicator_right'
  | 'hazard'
  | 'wipers'
  | 'seatbelt'

export type ControlKeyMap = {
  readonly throttle: readonly string[]
  readonly brake: readonly string[]
  readonly left: readonly string[]
  readonly right: readonly string[]
  readonly handbrake: readonly string[]
  readonly horn: readonly string[]
} & { readonly [command in ControlCommand]: readonly string[] }

/** Keys of a keyboard (`KeyboardEvent.code`). The host keeps them from its own bindings while someone drives. */
export const DEFAULT_CONTROL_KEYS: ControlKeyMap = {
  throttle: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  handbrake: ['Space'],
  horn: ['KeyH'],
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
  exit: ['KeyF'],
  indicator_left: ['Comma'],
  indicator_right: ['Period'],
  hazard: ['KeyB'],
  wipers: ['KeyO'],
  seatbelt: ['KeyJ'],
}

export type Gearbox = 'automatic' | 'manual'
export type DriveMode = '4x2' | '4x4' | 'auto'
export type LampMode = 'off' | 'position' | 'low' | 'high'
export type AlarmState = 'off' | 'armed' | 'ringing'
export type RadioSource = 'radio' | 'tape'
export type Indicator = 'off' | 'left' | 'right' | 'hazard'
export type Wipers = 'off' | 'slow' | 'fast'

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
  lamps: { mode: LampMode; fog: boolean; interior: boolean }
  /** What the rear lamps show this step: brake (pedal or handbrake) and reversing. */
  brakeLights: boolean
  reverseLights: boolean
  horn: boolean
  alarm: AlarmState
  radio: { on: boolean; source: RadioSource }
  indicator: Indicator
  /** The indicator lamps are lit this instant (they blink at `blinkHz`); `tick` is true on the step the relay clicks. */
  blinkOn: boolean
  tick: boolean
  wipers: Wipers
  seatbelt: boolean
}

export type ControlEvent = { type: 'command'; command: ControlCommand; state: ControlState } | { type: 'refused'; command: ControlCommand; reason: 'no_four_wheel_drive' | 'no_fog_lamps' | 'ignition_off' }

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
  onEvent?: (event: ControlEvent) => void
}

/** What the controls read of the driver each step, and the one thing they change on it (which axles drive). */
export interface ControlledDriver {
  readonly spec: { fourWheelDrive: boolean }
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
  for (const [command, codes] of Object.entries(keys)) if (!['throttle', 'brake', 'left', 'right', 'handbrake', 'horn'].includes(command)) for (const code of codes) commandOf.set(code, command as ControlCommand)
  const driving = new Set<string>(Object.values(keys).flat())

  const state: ControlState = {
    ignition: !!options.running,
    gearbox: options.gearbox ?? 'automatic',
    gear: 1,
    parkingBrake: false,
    driveMode: options.fourWheelDrive ? 'auto' : '4x2',
    fourWheelEngaged: false,
    lamps: { mode: 'off', fog: false, interior: false },
    brakeLights: false,
    reverseLights: false,
    horn: false,
    alarm: 'off',
    radio: { on: false, source: 'radio' },
    indicator: 'off',
    blinkOn: false,
    tick: false,
    wipers: 'off',
    seatbelt: false,
  }
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

  const command = (c: ControlCommand): void => {
    switch (c) {
      case 'ignition':
        state.ignition = !state.ignition
        // the driver turning the key disarms the alarm; turning it off leaves the radio playing on the battery
        if (state.ignition && state.alarm !== 'off') state.alarm = 'off'
        break
      case 'gearbox':
        state.gearbox = state.gearbox === 'automatic' ? 'manual' : 'automatic'
        state.gear = Math.max(1, state.gear)
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
        state.wipers = state.wipers === 'off' ? 'slow' : state.wipers === 'slow' ? 'fast' : 'off'
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
      // the key off: no gas reaches the engine (the pedal would start it); the brakes still work
      const gasNow = state.ignition ? throttle : 0
      const reversing = state.gearbox === 'manual' ? state.gear < 0 : (driver?.state.gear ?? 1) < 0
      state.reverseLights = reversing
      state.brakeLights = handbrake || (reversing ? gasNow > 0.05 && (driver?.state.u ?? 0) < -0.3 : brake > 0.05)
      if (state.gearbox === 'automatic') return { throttle: gasNow, brake, steer, handbrake, horn: state.horn }
      // manual: the gas drives the chosen gear either way (backwards in reverse) and the brake only brakes; the driver reads the pedals against the direction of travel
      return state.gear < 0 ? { throttle: brake, brake: gasNow, steer, handbrake, horn: state.horn, gear: state.gear } : { throttle: gasNow, brake, steer, handbrake, horn: state.horn, gear: state.gear }
    },
    after(driver, dt) {
      // the gas pedal started the engine (the semi driver does when it stalled): the key is on
      if (driver.state.engineOn && !state.ignition && driver.state.u !== 0) state.ignition = true
      if (!state.ignition && driver.state.engineOn) (driver.state as { engineOn: boolean }).engineOn = false
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
    },
  }
}
