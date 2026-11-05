const GRAVITY = 9.81
/** Per second, the share of a body's speed water takes when it is all under: a body in water bobs once and stops, it does not bounce. */
const WATER_DRAG = 9
/** The liquid does not throw a very light body out: past this many times its weight the push has nothing more to give. */
const MAX_LIFT_WEIGHTS = 1.6

export interface WaterLiftParams {
  /** Kilograms. */
  readonly mass: number
  /** Cubic metres of the whole body. */
  readonly volume: number
  /** Share of the body under the surface, 0..1. */
  readonly submerged: number
  /** Kilograms per cubic metre of the liquid. */
  readonly liquidDensity?: number
  readonly gravity?: number
}

export interface WaterLift {
  /** Upward metres per second squared the liquid gives the body. */
  readonly acceleration: number
  /** Per second, the part of the speed the liquid takes. */
  readonly drag: number
  /** Lighter than the liquid it displaces. */
  readonly floats: boolean
}

/** Archimedes on a body in a liquid: what it displaces lifts it, so a light log floats and a concrete block goes to the bed. */
export function waterLift(params: WaterLiftParams): WaterLift {
  const density = params.liquidDensity ?? 1000
  const submerged = Math.max(0, Math.min(1, params.submerged))
  const mass = Math.max(1e-6, params.mass)
  const gravity = params.gravity ?? GRAVITY
  return {
    acceleration: Math.min(MAX_LIFT_WEIGHTS * gravity, (density * params.volume * submerged * gravity) / mass),
    drag: WATER_DRAG * submerged,
    floats: mass / Math.max(1e-9, params.volume) < density,
  }
}
