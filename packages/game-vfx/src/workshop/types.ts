import type { RandomStream } from '../random'

export type Vec3Tuple = readonly [number, number, number]
export type SpriteRange = number | readonly [number, number]

/**
 * What the Workshop's particle systems take (W179-220). The keys are the page's own (`sp` speed, `fi` fade-in, `gnd` ground mode, `ds` decal size) and
 * their order in a recipe is the order the page wrote them: the golden compares the options as text.
 */
export interface SpriteSpawn {
  readonly p: Vec3Tuple
  readonly r?: number
  readonly flat?: boolean
  readonly box?: Vec3Tuple
  readonly dir?: Vec3Tuple
  readonly cone?: number
  readonly sp?: SpriteRange
  readonly v?: Vec3Tuple
  readonly life?: SpriteRange
  readonly size?: SpriteRange
  readonly grow?: number
  readonly c0?: number
  readonly c1?: number
  readonly a?: number
  readonly g?: number
  readonly drag?: number
  readonly fi?: number
  /** 0 flies free, 1 dies at the ground, 2 bounces, 3 leaves a blood decal. */
  readonly gnd?: 0 | 1 | 2 | 3
  readonly ds?: SpriteRange
  readonly len?: number
}

export interface DebrisSpawn {
  readonly p: Vec3Tuple
  readonly dir?: Vec3Tuple
  readonly cone?: number
  readonly sp?: SpriteRange
  readonly v?: Vec3Tuple
  readonly size?: Vec3Tuple | readonly [SpriteRange, SpriteRange, SpriteRange]
  readonly k?: SpriteRange
  readonly box?: Vec3Tuple
  readonly c?: number
  readonly spin?: number
  readonly life?: number
  readonly bounce?: number
}

export interface DecalOptions {
  readonly n?: Vec3Tuple
  readonly grow?: number
  readonly life?: number
  readonly delay?: number
  readonly ar?: number
  readonly dark?: number
  readonly dry?: number
  readonly dryAt?: number
  readonly dryT?: number
  readonly fluid?: 'blood' | 'oil' | 'fuel' | 'bile' | 'water'
}

export type SpriteSystem = 'add' | 'normal' | 'streak'
export type TraceKind = 'add' | 'normal' | 'streak' | 'debris' | 'decal' | 'ring' | 'flash'

/** Hears each spawn in call order with the arguments the page's function got; the Workshop golden records the same calls. */
export type WorkshopTrace = (kind: TraceKind, args: readonly unknown[]) => void

export interface WorkshopContext {
  /** Swapped while an effect with a seed of its own runs, so a LAN client draws the same numbers. */
  random: RandomStream
  readonly groundAt: (x: number, z: number) => number
  readonly quality: { level: number; mult: number }
  readonly trace: WorkshopTrace | undefined
}
