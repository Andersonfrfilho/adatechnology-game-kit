/**
 * Smoke out of a damaged engine bay as a plume: many small, see-through puffs that leave the top of the bay, climb, widen, drift with the
 * wind and thin out. The colour says the cause: coolant steam is white, oil burning on the hot block is light grey, and only a fire of
 * rubber or fuel gives black smoke. Pure numbers: `particles.ts` turns each puff into a sprite (or a request to the host's effects world).
 */

/** What is burning or boiling under the hood. */
export const SmokeCause = { STEAM: 'steam', OIL: 'oil', FIRE: 'fire' } as const
export type SmokeCause = (typeof SmokeCause)[keyof typeof SmokeCause]

/** Colour and peak opacity of one puff of a cause. */
export interface SmokeLook {
  readonly color: number
  readonly alpha: number
}

export const SMOKE_LOOKS: Readonly<Record<SmokeCause, SmokeLook>> = {
  [SmokeCause.STEAM]: { color: 0xe2e6e8, alpha: 0.18 },
  [SmokeCause.OIL]: { color: 0xa9aeb2, alpha: 0.2 },
  [SmokeCause.FIRE]: { color: 0x232324, alpha: 0.3 },
}

/** The emitter kinds of `kit.addEmitter` that are smoke, and the cause each one draws. */
const CAUSE_OF_EMITTER: Readonly<Record<string, SmokeCause>> = { white: SmokeCause.STEAM, oil: SmokeCause.OIL, black: SmokeCause.FIRE }

export const smokeCauseOfEmitter = (kind: string): SmokeCause | undefined => CAUSE_OF_EMITTER[kind]

/** Light emission at the first damage, full emission at a wreck: puffs a second grow with the damage (0 intact, 1 wrecked). */
const RATE_AT_NO_DAMAGE = 0.35
const RATE_AT_WRECK = 2.2

export function smokeRate(baseRate: number, damage: number): number {
  const level = Math.min(1, Math.max(0, damage))
  return baseRate * (RATE_AT_NO_DAMAGE + (RATE_AT_WRECK - RATE_AT_NO_DAMAGE) * level)
}

/** Puffs born per emission: a plume is many faint puffs overlapping, never a few dense ones. */
export const PLUME_PUFFS = 3

/** The wind the plume leans with, metres a second (the same wind the kit's own puffs drift to). */
export const SMOKE_WIND: readonly [number, number, number] = [-0.45, 0, 0.16]

/** Upward pull of hot smoke (m/s², as negative gravity) and the air drag that slows it: together a steady climb of about a metre a second. */
const LIFT: Readonly<Record<SmokeCause, number>> = { [SmokeCause.STEAM]: 0.5, [SmokeCause.OIL]: 0.45, [SmokeCause.FIRE]: 0.6 }
const DRAG = 0.4

/** How far over the top of the bay the puffs are born, and how far apart over the opening. */
const VENT_CLEARANCE = 0.08
const VENT_SPREAD = 0.18

/** The numbers of one puff, in the emitter's frame (offset from the vent, velocity) and as the sprite reads them. */
export interface SmokePuff {
  readonly offset: readonly [number, number, number]
  readonly velocity: readonly [number, number, number]
  /** Start size in metres and end size as a multiple of it. */
  readonly size: number
  readonly growth: number
  readonly life: number
  readonly color: number
  readonly alpha: number
  /** Upward pull (m/s²) and drag (1/s) the effects world applies over the life. */
  readonly lift: number
  readonly drag: number
}

export interface SmokePuffParams {
  readonly cause: SmokeCause
  /** Size of the source (1 a car's engine bay). */
  readonly scale: number
  /** Uniform random numbers in [0, 1). */
  readonly random: () => number
  /** Wind in the emitter's frame (default `SMOKE_WIND`). */
  readonly wind?: readonly [number, number, number]
}

const jitter = (random: () => number, span: number): number => (random() - 0.5) * 2 * span

/** One puff of the plume: small and see-through at birth, rising and leaning with the wind, several times wider when it fades. */
export function smokePuff(params: SmokePuffParams): SmokePuff {
  const { cause, scale, random } = params
  const wind = params.wind ?? SMOKE_WIND
  const look = SMOKE_LOOKS[cause]
  const isFire = cause === SmokeCause.FIRE
  return {
    offset: [jitter(random, VENT_SPREAD * scale), random() * 0.05, jitter(random, VENT_SPREAD * scale)],
    velocity: [wind[0] + jitter(random, 0.22), 0.55 + random() * 0.5, wind[2] + jitter(random, 0.22)],
    size: (isFire ? 0.2 : 0.14) * scale * (0.8 + random() * 0.4),
    growth: (isFire ? 6 : 5) + random() * 2,
    life: (isFire ? 3.4 : 2.6) + random() * 1.2,
    color: look.color,
    alpha: look.alpha * (0.8 + random() * 0.4),
    lift: LIFT[cause],
    drag: DRAG,
  }
}

/** A box of the vehicle frame: centre and full size. */
export interface BayBox {
  readonly center: readonly [number, number, number]
  readonly size: readonly [number, number, number]
}

/**
 * Where the smoke leaves the bay: just over the top of the engine, and towards the front of it (`+x` is forward in the vehicle frame), so the
 * plume rises off the hood and not through the windshield behind it.
 */
export function engineBayVent(box: BayBox): [number, number, number] {
  const [cx, cy, cz] = box.center
  const [sx, sy] = box.size
  return [cx + sx * 0.15, cy + sy / 2 + VENT_CLEARANCE, cz]
}
