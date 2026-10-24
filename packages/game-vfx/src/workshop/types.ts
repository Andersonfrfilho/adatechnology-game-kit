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

/** The solids a mesh particle can be: a cone (closed or open at the base), a sphere, an icosahedron. */
export type MeshShape = 'cone' | 'cone_open' | 'sphere' | 'icosahedron'

/**
 * A particle that is a solid, not a sprite (the Arsenal gallery's flash is a cone, four small cones and a sphere, its smoke are spheres, its flames icosahedra).
 * Metres and radians, three.js's axes and Euler order (XYZ). `p` is the point the group sits at, `at` the piece's place in the group, which grows with the
 * group's scale; `rot` turns the piece in the group, `roll` turns the whole group about its own x axis, and the group itself is turned by the placement. A piece with
 * neither `at` nor `roll` is free (smoke, a flame): its `rot` is in the world.
 */
export interface MeshSpawn {
  readonly shape: MeshShape
  /** The radius: of a cone's base, a sphere, an icosahedron. */
  readonly r: number
  /** A cone's height. */
  readonly h?: number
  /** Radial segments of a cone, width segments of a sphere, detail of an icosahedron. */
  readonly seg?: number
  /** Height segments of a cone (1) or a sphere. */
  readonly seg2?: number
  readonly p: Vec3Tuple
  readonly at?: Vec3Tuple
  readonly rot?: Vec3Tuple
  readonly roll?: number
  /** Velocity in the recipe's space (turned with the placement) and in the world (as is); they add. */
  readonly v?: Vec3Tuple
  readonly wv?: Vec3Tuple
  /** Radians per second about the piece's own x, y, z (added to `rot` every frame). */
  readonly spin?: Vec3Tuple
  /** Seconds it lives. */
  readonly life: number
  /** Subtracted from the vertical velocity each second (negative rises). */
  readonly g?: number
  /** Fraction of the speed lost per second. */
  readonly drag?: number
  /** Growth per second as a fraction of the size, applied every frame. */
  readonly grow?: number
  /** `[from, rise]`: the scale is `from + min(1, age / life) * rise`, and the piece ends when the ramp does. */
  readonly ramp?: readonly [number, number]
  readonly c0: number
  /** Opacity: kept, or (with `fade`) the one it starts from on its way to nothing over its life. */
  readonly a: number
  readonly fade?: boolean
  /** Added to what is behind it (a flash), not mixed with it. */
  readonly add?: boolean
  /** Shaded by the scene's lights (smoke), not flat. */
  readonly lit?: boolean
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
export type TraceKind = 'add' | 'normal' | 'streak' | 'debris' | 'decal' | 'ring' | 'flash' | 'mesh'

/** Hears each spawn in call order with the arguments the page's function got; the Workshop golden records the same calls. */
export type WorkshopTrace = (kind: TraceKind, args: readonly unknown[]) => void

export interface WorkshopContext {
  /** Swapped while an effect with a seed of its own runs, so a LAN client draws the same numbers. */
  random: RandomStream
  readonly groundAt: (x: number, z: number) => number
  readonly quality: { level: number; mult: number }
  readonly trace: WorkshopTrace | undefined
}
