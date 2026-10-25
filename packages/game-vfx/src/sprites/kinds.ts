import kindData from '../data/sprite-kinds.json'

/** The kinds of sprite the game's pools make: debris, sparks, smoke, steam, drips... (the destruction renderer's old `ParticleKind`). */
export type SpriteKind =
  | 'fire' | 'smoke' | 'sparks' | 'dust' | 'shards' | 'splinters' | 'chips' | 'fibers' | 'leaves' | 'drips' | 'ash' | 'steam' | 'flash' | 'foam'

/** What happens to a sprite that reaches the ground. */
export type SpriteGround = 'none' | 'bounce' | 'stop' | 'land'

export interface SpriteKindDef {
  readonly id: SpriteKind
  readonly additive: boolean
  /** Life range in seconds. */
  readonly life: readonly [number, number]
  /** Start size range in metres (billboard diameter). */
  readonly size: readonly [number, number]
  /** Size multiplier reached at the end of the life. */
  readonly grow: number
  /** Gravity multiplier (1 = full gravity). */
  readonly gravity: number
  /** Constant upward acceleration in m/s² (heat, steam). */
  readonly rise: number
  /** Velocity damping per second. */
  readonly drag: number
  /** `0xRRGGBB` at the start and at the end of the life. */
  readonly c0: number
  readonly c1: number
  readonly alpha: number
  /** Fraction of the life spent fading in. */
  readonly fadeIn: number
  /** How much of the emission direction follows the surface normal (1) versus a random direction (0). */
  readonly cone: number
  readonly ground: SpriteGround
  readonly flutter?: number
  readonly flicker?: number
}

export const SPRITE_KINDS: Readonly<Record<SpriteKind, SpriteKindDef>> = kindData as unknown as Record<SpriteKind, SpriteKindDef>

/** A copy of the kinds with some changed (a partial replaces the fields it names), added or removed (`null`); a game tunes its sprites without touching the core. */
export function patchSpriteKinds(
  base: Readonly<Record<string, SpriteKindDef>>,
  changes: Readonly<Record<string, Partial<SpriteKindDef> | SpriteKindDef | null>>,
): Record<string, SpriteKindDef> {
  const result: Record<string, SpriteKindDef> = { ...base }
  for (const [id, change] of Object.entries(changes)) {
    if (change === null) delete result[id]
    else result[id] = { ...(base[id] ?? {}), ...change, id } as SpriteKindDef
  }
  return result
}
