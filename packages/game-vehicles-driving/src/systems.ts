/**
 * What keeps a car running besides the engine: the 12 V battery (the lamps, radio, wipers and alarm draw from it, the alternator charges it while
 * the engine turns, and below what the starter needs the car does not start), the coolant temperature (it climbs with the work of the engine, the air
 * through the radiator and the fan take it away, and a damaged radiator boils it: past `limpC` the engine loses power, past `seizeC` it dies) and the
 * spare tyre (one flat wheel can be swapped for it). It reads the driver and the controls and changes only what a real car would: the engine state,
 * the power it gives and the tyres. Every number is an option.
 */
import type { ControlState } from './controls'
import type { SemiState, VehicleCondition } from './semi/types'

export interface ElectricalLoads {
  /** Watts of each consumer while on. */
  readonly position: number
  readonly low: number
  readonly high: number
  readonly fog: number
  readonly interior: number
  readonly radio: number
  readonly wipers: number
  readonly indicators: number
  readonly horn: number
  readonly alarm: number
  readonly brakeLights: number
  readonly climate: number
  /** An emergency vehicle's siren amplifier and its beacon (light bar). */
  readonly siren: number
  readonly beacon: number
}

export interface VehicleSystemsOptions {
  /** Battery capacity, watt-hours (a 12 V 60 Ah battery holds 720). */
  batteryWh?: number
  /** Charge at the start, 0..1. */
  charge?: number
  /** Alternator output, watts, at idle and from 2000 rpm up. */
  alternatorW?: { idle: number; full: number }
  /** Below this charge the starter does not turn the engine over. */
  crankCharge?: number
  /** Energy of one start, watt-hours. */
  startWh?: number
  loads?: Partial<ElectricalLoads>
  /** Air temperature, °C. */
  ambientC?: number
  /** The thermostat holds the coolant here once warm. */
  thermostatC?: number
  /** Limp mode above this (power cut), engine seizes above `seizeC`. */
  limpC?: number
  seizeC?: number
  /** Warming of the coolant, °C per second at full power; cooling share of the gap to the air per second, at a stop and at 100 km/h. */
  heatPerSecond?: number
  cooling?: { stopped: number; fast: number }
  /** Spare tyres carried. */
  spares?: number
}

export const DEFAULT_LOADS: ElectricalLoads = { position: 20, low: 110, high: 130, fog: 110, interior: 10, radio: 25, wipers: 60, indicators: 42, horn: 60, alarm: 5, brakeLights: 42, climate: 180, siren: 100, beacon: 70 }

export type SystemsEvent = { type: 'battery_flat' } | { type: 'overheating' } | { type: 'seized' } | { type: 'spare_fitted'; wheel: number } | { type: 'no_spare' }

export interface SystemsState {
  /** 0..1. */
  charge: number
  /** Coolant, °C. */
  coolantC: number
  /** 0 cold (the air) to 1 (the seize point), for a gauge. */
  temperature: number
  overheating: boolean
  seized: boolean
  spares: number
  /** Net watts on the battery this step: positive charging, negative draining. */
  netW: number
}

export interface SystemsDriver {
  readonly state: Pick<SemiState, 'engineOn' | 'rpm' | 'u'>
  condition: VehicleCondition
}

export interface SystemsStepParams {
  driver: SystemsDriver
  controls: ControlState
  /** The gas the engine got this step, 0..1. */
  throttle: number
  dt: number
  /** What is left of the radiator, 0..1. Default 1. */
  radiator?: number
  /** The coolant temperature from a damage model that tracks it (the vehicle destructible's `runEngine`): it replaces this model's own. */
  coolantC?: number
}

export interface VehicleSystems {
  readonly state: SystemsState
  /** The starter can turn the engine over now. */
  canCrank(): boolean
  /** Takes the energy of one start. */
  crank(): void
  /** Share of the torque the engine gives now (limp mode when hot). */
  powerLimit(): number
  /** Advances `dt` seconds; `throttle` is the gas the engine got, `controls` what is switched on. */
  step(params: SystemsStepParams): SystemsEvent[]
  /** Swaps the flat tyre of `wheel` for the spare. */
  fitSpare(driver: SystemsDriver, wheel: number): SystemsEvent
  /** Fills the battery (a jump start or a charger), 0..1 of the capacity. */
  charge(share: number): void
}

const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x))

export function createVehicleSystems(options: VehicleSystemsOptions = {}): VehicleSystems {
  const loads: ElectricalLoads = { ...DEFAULT_LOADS, ...options.loads }
  const capacity = options.batteryWh ?? 720
  const alternator = options.alternatorW ?? { idle: 350, full: 1100 }
  const crankCharge = options.crankCharge ?? 0.25
  const startWh = options.startWh ?? 0.6
  const ambient = options.ambientC ?? 25
  const thermostat = options.thermostatC ?? 90
  const limp = options.limpC ?? 115
  const seize = options.seizeC ?? 130
  const heat = options.heatPerSecond ?? 0.5
  const cooling = options.cooling ?? { stopped: 0.004, fast: 0.03 }
  const state: SystemsState = { charge: clamp(options.charge ?? 1, 0, 1), coolantC: ambient, temperature: 0, overheating: false, seized: false, spares: options.spares ?? 1, netW: 0 }

  const draw = (c: ControlState): number => {
    const lamps = c.lamps
    let w = lamps.mode === 'off' ? 0 : loads.position
    if (lamps.mode === 'low') w += loads.low
    if (lamps.mode === 'high') w += loads.low + loads.high
    if (lamps.flash) w += loads.high
    if (lamps.fog) w += loads.fog
    if (lamps.interior) w += loads.interior
    if (c.radio.on) w += loads.radio
    if (c.wipers !== 'off' || c.washer) w += loads.wipers
    if (c.indicator !== 'off') w += loads.indicators * (c.indicator === 'hazard' ? 2 : 1) * 0.5
    if (c.horn) w += loads.horn
    if (c.alarm !== 'off') w += loads.alarm
    if (c.brakeLights) w += loads.brakeLights
    if (c.climate.on) w += loads.climate
    if (c.siren !== 'off') w += loads.siren
    if (c.beacon) w += loads.beacon
    return w
  }

  return {
    state,
    canCrank: () => state.charge >= crankCharge && !state.seized,
    crank() {
      state.charge = clamp(state.charge - startWh / capacity, 0, 1)
    },
    powerLimit: () => (state.coolantC <= limp ? 1 : clamp(1 - (state.coolantC - limp) / (seize - limp), 0.25, 1)),
    step({ driver, controls, throttle, dt, radiator = 1, coolantC }) {
      const events: SystemsEvent[] = []
      const running = driver.state.engineOn
      const charging = running ? alternator.idle + (alternator.full - alternator.idle) * clamp((driver.state.rpm - 900) / 1100, 0, 1) : 0
      // the key off leaves only what is wired to the battery directly: lamps, hazard, interior light, alarm, radio on memory
      const net = charging - draw(controls)
      state.netW = net
      const before = state.charge
      state.charge = clamp(state.charge + (net * dt) / 3600 / capacity, 0, 1)
      if (before >= crankCharge && state.charge < crankCharge && !running) events.push({ type: 'battery_flat' })
      // coolant: the engine's work heats it, the thermostat holds it until the radiator cannot keep up; a broken radiator barely cools
      const work = running ? clamp(0.15 + 0.85 * throttle * (driver.state.rpm / 6500), 0, 1) : 0
      const air = cooling.stopped + (cooling.fast - cooling.stopped) * clamp(Math.abs(driver.state.u) / 27.8, 0, 1)
      const cool = air * clamp(radiator, 0.05, 1) * (running ? 1 + (controls.climate.on ? 0.15 : 0) : 1)
      const opened = state.coolantC >= thermostat ? 1 : 0.15
      state.coolantC += (heat * work - cool * opened * (state.coolantC - ambient)) * dt
      state.coolantC = coolantC ?? Math.max(ambient, state.coolantC)
      state.temperature = clamp((state.coolantC - ambient) / (seize - ambient), 0, 1)
      const hot = state.coolantC > limp
      if (hot && !state.overheating) events.push({ type: 'overheating' })
      state.overheating = hot
      if (state.coolantC >= seize && !state.seized) {
        state.seized = true
        events.push({ type: 'seized' })
      }
      if (state.seized) (driver.state as { engineOn: boolean }).engineOn = false
      return events
    },
    fitSpare(driver, wheel) {
      if (state.spares <= 0) return { type: 'no_spare' }
      state.spares--
      const tyres = [...(driver.condition.tyres ?? [])]
      tyres[wheel] = 1
      driver.condition = { ...driver.condition, tyres }
      return { type: 'spare_fitted', wheel }
    },
    charge(share) {
      state.charge = clamp(state.charge + share, 0, 1)
    },
  }
}
