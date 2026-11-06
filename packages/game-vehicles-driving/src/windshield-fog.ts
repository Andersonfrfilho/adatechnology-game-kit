/**
 * The glass misting up from inside. The people in the cabin breathe water into its air and wet clothes from the rain bring more; the air
 * that comes in (an open window, the fan, the air conditioning that dries it) takes it out. Fog forms when that moisture is past what the glass
 * holds clear, which drops the colder the glass is than the cabin (a cold day, rain on the glass, speed); the demister blows dry, warm air on it and
 * clears it in a few seconds once the engine is warm. The wipers clean only the outside: they do nothing to it. Every number is an option.
 */

export interface WindshieldFogOptions {
  /** Moisture of the air outside, 0..1. Default 0.6. */
  outsideHumidity?: number
  /** Moisture one occupant breathes into the cabin, share of saturation per second. Default 0.004. */
  breath?: number
  /** Moisture of wet clothes in the rain, per second at full rain. Default 0.002. */
  wet?: number
  /** Air change of a shut cabin per second, and what a window fully down, the climate fan and the demister add to it. */
  air?: { shut: number; window: number; climate: number; demist: number }
  /** Degrees of glass below the cabin that bring the fog down to half the moisture (0 degrees: fog only at saturation). Default 15. */
  coldSpan?: number
  /** Fog builds up, clears on its own and clears under the warm demister, share of the glass per second. */
  rates?: { build: number; clear: number; demist: number }
}

export interface WindshieldFogState {
  /** Moisture of the cabin's air, 0..1 (1 saturated). */
  humidity: number
  /** Share of the glass misted, 0..1. */
  fog: number
}

export interface WindshieldFogStep {
  dt: number
  /** People inside. */
  occupants: number
  /** Air temperature outside and in the cabin, °C. */
  outsideC: number
  cabinC: number
  /** Rain on the glass, 0..1. */
  rain?: number
  /** Speed, m/s: the wind over the glass cools it. */
  speed?: number
  /** The windows' opening, 0..1 summed share (one window fully down is 0.25 of a four-door car's four). */
  windows?: number
  climate: { on: boolean; demist: boolean }
  /** How warm the engine is, 0..1 (the demister blows cold air from a cold engine: it dries but does not warm the glass). */
  engineWarm?: number
}

export interface WindshieldFog {
  readonly state: WindshieldFogState
  step(params: WindshieldFogStep): WindshieldFogState
  /** Sets the moisture and the fog at once (a car found shut in the rain). */
  set(state: Partial<WindshieldFogState>): void
}

const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x))

export function createWindshieldFog(options: WindshieldFogOptions = {}): WindshieldFog {
  const outside = options.outsideHumidity ?? 0.6
  const breath = options.breath ?? 0.004
  const wet = options.wet ?? 0.002
  const air = options.air ?? { shut: 0.002, window: 0.05, climate: 0.01, demist: 0.06 }
  const coldSpan = options.coldSpan ?? 15
  const rates = options.rates ?? { build: 0.05, clear: 0.03, demist: 0.25 }
  const state: WindshieldFogState = { humidity: outside, fog: 0 }
  return {
    state,
    step({ dt, occupants, outsideC, cabinC, rain = 0, speed = 0, windows = 0, climate, engineWarm = 1 }) {
      const exchange = air.shut + air.window * clamp(windows, 0, 1) + (climate.on ? air.climate : 0) + (climate.demist ? air.demist : 0)
      const source = breath * Math.max(0, occupants) + wet * clamp(rain, 0, 1) * (occupants > 0 ? 1 : 0)
      // the air conditioning dries what comes in: with it on, the cabin tends to the outside air with most of its water left on the evaporator
      const towards = climate.on ? outside * 0.4 : outside
      state.humidity = clamp(state.humidity + (source - exchange * (state.humidity - towards)) * dt, 0, 1)
      // the glass is colder than the cabin by the weather (an open window brings the cabin towards the air outside), the rain on it and the wind of
      // speed; the warm demister brings it up to the cabin
      const cold = Math.max(0, cabinC - outsideC) * (1 - 0.7 * clamp(windows, 0, 1)) + 6 * clamp(rain, 0, 1) + 2 * clamp(speed / 27.8, 0, 1)
      const warmed = climate.demist ? cold * (1 - 0.9 * clamp(engineWarm, 0, 1)) : cold
      const clearUpTo = 1 - 0.5 * clamp(warmed / coldSpan, 0, 1)
      const target = clamp((state.humidity - clearUpTo) * 6, 0, 1)
      const down = climate.demist ? rates.demist * (0.3 + 0.7 * clamp(engineWarm, 0, 1)) : rates.clear
      state.fog = target > state.fog ? Math.min(target, state.fog + rates.build * dt) : Math.max(target, state.fog - down * dt)
      return state
    },
    set(next) {
      if (next.humidity !== undefined) state.humidity = clamp(next.humidity, 0, 1)
      if (next.fog !== undefined) state.fog = clamp(next.fog, 0, 1)
    },
  }
}
