/** Every number of a weather state; these are the values that blend between two states. */
export type StateValues = {
  /** Rain in mm/h. */
  readonly rain: number
  /** Drops the renderer keeps in the air. */
  readonly drops: number
  /** 0..1: rain sheets (curtains of water) passing. */
  readonly sheets: number
  /** Wind in m/s along x and z (the rain slants by windX). */
  readonly windX: number
  readonly windZ: number
  /** Strongest gust in m/s. */
  readonly gust: number
  /** Linear fog far distance in metres (render). */
  readonly fogFar: number
  /** Exponential-squared fog density; 0 means linear fog. */
  readonly fogDensity: number
  /** Multiplies the sky colour. */
  readonly skyScale: number
  /** How far one sees for gameplay, in metres (not the render fog). */
  readonly visibility: number
  /** Relative humidity, 0..1, before the climate offset. */
  readonly humidity: number
  /** Added to the climate's temperature of the moment. */
  readonly temperatureDeltaC: number
  /** Ground wetness this state wets up to, 0..1. */
  readonly wetness: number
  /** Multiplies the radius at which listeners hear (rain masks). */
  readonly hearingScale: number
  /** Multiplies the noise footsteps make. */
  readonly footstepScale: number
  /** Multiplies how fast wet ground dries. */
  readonly dryingScale: number
  /** Acceleration in m/s² that wind puts on loose debris. */
  readonly debrisPush: number
  /** 0..1: heat haze. */
  readonly haze: number
  readonly mistPerSecond: number
  readonly ashPerSecond: number
}

export type StateValueKey = keyof StateValues

/** Strikes of a state: seconds between them, seconds to the first one, how far they land and how long a flash reveals the scene. */
export type LightningConfig = {
  readonly interval: readonly [min: number, max: number]
  readonly first: readonly [min: number, max: number]
  readonly distance: readonly [min: number, max: number]
  readonly reveal: number
}

export type WeatherState = StateValues & {
  readonly id: string
  /** Where each number comes from: a team source and line, or the design decision that set it. */
  readonly sources: readonly string[]
  readonly lightning?: LightningConfig
}

export type Climate = {
  readonly id: string
  readonly sources: readonly string[]
  readonly start: string
  /** Game hours a state lasts, drawn uniformly. */
  readonly dwellHours: readonly [min: number, max: number]
  /** Game minutes a change takes to blend. */
  readonly blendMinutes: number
  /** Where fronts travel to: [1, 0] is toward +x, so they arrive from the west. */
  readonly frontDirection: readonly [x: number, z: number]
  readonly temperatureC: { readonly mean: number; readonly swing: number }
  readonly humidityOffset: number
  /** From state to the weights of the next one. A state that is not here, or has nothing reachable, stays. */
  readonly transitions: Readonly<Record<string, Readonly<Record<string, number>>>>
}

export type DeepPartial<TValue> = {
  readonly [Key in keyof TValue]?: NonNullable<TValue[Key]> extends readonly unknown[] ? TValue[Key] : NonNullable<TValue[Key]> extends object ? DeepPartial<NonNullable<TValue[Key]>> : TValue[Key]
}

export type WeatherEffects = {
  /** Gameplay visibility in metres. */
  readonly visibility: number
  /** Multiplies how far something sees (`perc[0]` of the game): weather times `1 - 0.4 × nightFactor`. */
  readonly sightScale: number
  /** Multiplies how far something hears (rain masks sound). */
  readonly hearingScale: number
  /** Multiplies the noise a footstep makes. */
  readonly footstepScale: number
  readonly heatIndexC: number
  /** 0..1 on the NOAA bands 27, 32, 41 and 54 °C. */
  readonly heatStress: number
  /** Seconds a flash lights the scene (0 where there is no lightning). */
  readonly lightningReveal: number
  readonly dryingScale: number
  readonly debrisPush: number
}

export type Strike = {
  readonly id: number
  /** Simulation seconds since the weather started. */
  readonly time: number
  /** Game seconds since the weather started. */
  readonly gameSeconds: number
  /** Metres from the listener. */
  readonly distance: number
  /** Degrees clockwise from north. */
  readonly bearing: number
  /** Seconds from the flash to the thunder: distance / 343. */
  readonly thunderDelay: number
}

export type WeatherSample = StateValues & {
  readonly gameSeconds: number
  /** 0 is midnight, 0.5 is noon. */
  readonly dayFraction: number
  readonly hour: number
  readonly nightFactor: number
  /** 0..1 sun height (the game's `s`). */
  readonly sun: number
  /** The state being blended to (or settled in), and the one it is leaving while the blend runs. */
  readonly state: string
  readonly previous: string | undefined
  /** 0..1: how far the blend has come; 1 is settled. */
  readonly blend: number
  readonly front: { readonly direction: readonly [x: number, z: number]; readonly progress: number }
  readonly windSpeed: number
  readonly temperatureC: number
  /** Relative humidity in percent, with the climate offset. */
  readonly humidityPercent: number
  /** Ground wetness now, 0..1 (rises with rain, dries 180 s after it stops). */
  readonly groundWetness: number
  /** 0..1 flash of the latest strike (the Workshop's double flash). */
  readonly flash: number
  readonly effects: WeatherEffects
}

export type WeatherEventMap = {
  readonly transition: { readonly from: string; readonly to: string; readonly gameSeconds: number }
  readonly strike: Strike
  readonly thunder: Strike
}
