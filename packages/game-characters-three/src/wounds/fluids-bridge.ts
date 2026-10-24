import type { DestructionEvent, Vec3 } from '@adatechnology/game-contracts'

/** The part of a fluid world the bridge needs; `FluidWorld` from `@adatechnology/game-fluids` has it. The package does not import the fluids packages. */
export type BloodSink = {
  splash(liquid: string, point: Vec3, liters: number, velocity?: Vec3): void
}

export type FluidsBridgeOptions = {
  readonly sink: BloodSink
  /** Id of the blood in the fluid world. Default `blood`. */
  readonly liquid?: string
  /** Metres per second a pressurised leak (a cut artery) throws its drops. Default 1.4. */
  readonly spurtSpeed?: number
}

export type FluidsBridge = {
  /** Reads a body's events: `leak` (bleeding) becomes blood on the surface below. Other events are ignored. */
  handle(event: DestructionEvent): void
  /** The blood a cut, a burst or a split spills at once, at the world point the piece left from. */
  burst(change: 'severed' | 'destroyed' | 'split', point: Vec3): void
  /** Blood from the engine's own bleeders: `litersPerSecond` over `dt` seconds at `point`. */
  bleed(point: Vec3, litersPerSecond: number, dt: number, direction?: Vec3, pressurized?: boolean): void
}

const BURST_LITERS = { severed: 0.35, destroyed: 0.6, split: 0.9 } as const

/**
 * Connects the wounds to the fluids packages, with the fluid world injected: the body keeps its own bleeders (rate, duration, spurt) and this turns them
 * into blood, so the stains, pools and drying are the fluids' business and the character code draws none.
 */
export const createFluidsBridge = ({ sink, liquid = 'blood', spurtSpeed = 1.4 }: FluidsBridgeOptions): FluidsBridge => {
  const bleed: FluidsBridge['bleed'] = (point, litersPerSecond, dt, direction = [0, -1, 0], pressurized = false) => {
    const liters = litersPerSecond * dt
    if (liters <= 0) return
    const speed = pressurized ? spurtSpeed : 0.15
    sink.splash(liquid, point, liters, [direction[0] * speed, direction[1] * speed, direction[2] * speed])
  }
  return {
    bleed,
    handle(event) {
      if (event.type === 'leak' && event.fluid === 'blood') bleed(event.point, event.rate, 1, event.direction, event.pressurized)
    },
    burst: (change, point) => sink.splash(liquid, point, BURST_LITERS[change]),
  }
}
