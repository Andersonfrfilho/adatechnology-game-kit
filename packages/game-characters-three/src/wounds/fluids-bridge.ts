import type { DestructionEvent, Vec3 } from '@adatechnology/game-contracts'

/** The part of a fluid world the bridge needs; `FluidWorld` from `@adatechnology/game-fluids` has it. The package does not import the fluids packages. */
export type BloodSink = {
  splash(liquid: string, point: Vec3, liters: number, velocity?: Vec3): void
}

/** Colours of one body's blood: the wet film and what it dries to (the infection age of a zombie: `ages.json`). */
export type BloodLook = {
  /** Liquid of the blood in the fluid world and in the film (default: the bridge's `liquid`). An old body can bleed `old_blood`. */
  readonly liquid?: string
  readonly tint?: { readonly fresh: number; readonly dry: number }
  /** How much of the blood is left, 0 to 1 (the age's `blood` factor): it scales the drops thrown into the film, so a dried-out body throws none. Default 1. */
  readonly amount?: number
}

/** The part of an infection age the look needs (`UndeadAge` of `@adatechnology/game-characters-undead` has all of it). */
export type BloodAge = { readonly id: string; readonly blood: number; readonly freshBloodColor: string; readonly dryBloodColor: string }

export type BloodLookOptions = {
  /** Ages with a blood factor below this bleed `thinLiquid` (default 0.3: the old and the decrepit). */
  readonly thinBelow?: number
  /** Liquid of the thin blood (default `old_blood`). */
  readonly thinLiquid?: string
}

const colorOf = (hex: string): number => Number.parseInt(hex.replace(/^#|^0x/i, ''), 16)

/** The blood of an infection age: its fresh and dry colours (`ages.json`), its amount, and `old_blood` for the thin ones. */
export const bloodLookOfAge = (age: BloodAge, options: BloodLookOptions = {}): BloodLook => ({
  ...(age.blood < (options.thinBelow ?? 0.3) ? { liquid: options.thinLiquid ?? 'old_blood' } : {}),
  tint: { fresh: colorOf(age.freshBloodColor), dry: colorOf(age.dryBloodColor) },
  amount: age.blood,
})

/** A drop thrown into the running film of the liquids (`createFilmBridge(...)` of `@adatechnology/game-fluids-three` has it). The package does not import the fluids packages. */
export type FilmSink = {
  splat(splat: {
    fluid: string
    point: Vec3
    direction?: Vec3
    speed?: number
    radius?: number
    count?: number
    tint?: { fresh: number; dry: number }
  }): number
}

/** What a `wound` throws into the film: the drops, how fast and how big. Defaults 3 drops at 2.5 m/s of 3.2 mm. */
export type WoundSpray = { readonly count?: number; readonly speed?: number; readonly radius?: number }

export type FluidsBridgeOptions = {
  readonly sink: BloodSink
  /** The running film: when given, a wound, a severed or destroyed segment and a split throw drops of blood into it, in the colours of the body's `BloodLook`. */
  readonly film?: FilmSink
  /** Drops of a wound (`wound` change of a `body` event). */
  readonly spray?: WoundSpray
  /** Drops thrown by a cut, a burst and a split (default 4, 7 and 10). */
  readonly burstDrops?: Readonly<Record<'severed' | 'destroyed' | 'split', number>>
  /** Id of the blood in the fluid world. Default `blood`. */
  readonly liquid?: string
  /** Metres per second a pressurised leak (a cut artery) throws its drops. Default 1.4. */
  readonly spurtSpeed?: number
}

export type FluidsBridge = {
  /** Reads a body's events: `leak` (bleeding) becomes blood on the surface below. Other events are ignored. */
  handle(event: DestructionEvent): void
  /** The blood a cut, a burst or a split spills at once, at the world point the piece left from (and the drops it throws into the film, when there is one). */
  burst(change: 'severed' | 'destroyed' | 'split', point: Vec3, look?: BloodLook, direction?: Vec3): void
  /** A wound that does not cut anything off (the `wound` change of the `body` event): drops of blood in the film, thrown along `direction` (default straight down). Returns how many found a grid. */
  wound(point: Vec3, look?: BloodLook, direction?: Vec3): number
  /** Blood from the engine's own bleeders: `litersPerSecond` over `dt` seconds at `point`. */
  bleed(point: Vec3, litersPerSecond: number, dt: number, direction?: Vec3, pressurized?: boolean): void
}

const BURST_LITERS = { severed: 0.35, destroyed: 0.6, split: 0.9 } as const
const BURST_DROPS = { severed: 4, destroyed: 7, split: 10 } as const

/**
 * Connects the wounds to the fluids packages, with the fluid world injected: the body keeps its own bleeders (rate, duration, spurt) and this turns them
 * into blood, so the stains, pools and drying are the fluids' business and the character code draws none.
 */
export const createFluidsBridge = ({ sink, film, spray, burstDrops = BURST_DROPS, liquid = 'blood', spurtSpeed = 1.4 }: FluidsBridgeOptions): FluidsBridge => {
  const throwDrops = (point: Vec3, wanted: number, look: BloodLook | undefined, direction: Vec3 | undefined, speed?: number, radius?: number): number => {
    const amount = look?.amount ?? 1
    const count = amount <= 0 ? 0 : Math.max(1, Math.round(wanted * Math.min(1, amount)))
    return film && count > 0
      ? film.splat({
          fluid: look?.liquid ?? liquid,
          point,
          count,
          ...(direction ? { direction } : {}),
          ...(speed !== undefined ? { speed } : {}),
          ...(radius !== undefined ? { radius } : {}),
          ...(look?.tint ? { tint: { fresh: look.tint.fresh, dry: look.tint.dry } } : {}),
        })
      : 0
  }
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
    burst(change, point, look, direction) {
      sink.splash(look?.liquid ?? liquid, point, BURST_LITERS[change])
      throwDrops(point, burstDrops[change], look, direction)
    },
    wound: (point, look, direction) => throwDrops(point, spray?.count ?? 3, look, direction, spray?.speed, spray?.radius),
  }
}
