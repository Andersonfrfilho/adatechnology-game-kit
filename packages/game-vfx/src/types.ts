import type { Rgb } from './color'

export type { Rgb }

export type Vec3Like = readonly [number, number, number]

/** The six layers of an explosion the viewer can turn off one by one (L478): flash and light, fire, shock wave, smoke and dust, shrapnel and debris, marks on the ground. */
export type VfxLayer = 'flash' | 'fire' | 'shock' | 'smoke' | 'shrapnel' | 'mark'

export const VFX_LAYERS: readonly VfxLayer[] = ['flash', 'fire', 'shock', 'smoke', 'shrapnel', 'mark']

/** A chain of things that move: anything with a position, or a position. */
export type Follow = { readonly x: number; readonly y: number; readonly z: number } | { readonly position: { readonly x: number; readonly y: number; readonly z: number } }

/** A residual fire left behind by an explosion (L798 `residual`), or started by `world.fire`. */
export interface FireSpec {
  /** Offsets from the blast point. */
  readonly dx?: number
  readonly dz?: number
  readonly radius: number
  readonly life: number
  readonly rate?: number
  readonly smoke?: number
  /** Grows from `startRadius` to `radius` over `grow` seconds. */
  readonly startRadius?: number
  readonly grow?: number
  /** `0xRRGGBB` of the smoke the fire gives (default soot black). */
  readonly smokeColor?: number
}

export interface MushroomSpec {
  readonly height: number
  readonly radius: number
  readonly count: number
  readonly stem: number
  readonly life: number
  /** How fast the ring climbs towards `height` (the Lab's `rk`, default .55). */
  readonly riseRate?: number
  readonly roll?: number
  readonly color?: number
}

/** The Lab's explosion profile with English names; every number is the Lab's (`sources` lists the lines they come from). */
export interface ExplosionDef {
  readonly id: string
  /** Radius (m) inside which a body is torn apart, and the one inside which it is hurt. */
  readonly lethal: number
  readonly injury: number
  /** Radius of the fireball (`vis`). */
  readonly visualRadius: number
  readonly fireballs: number
  readonly fuel?: boolean
  readonly heat?: number
  readonly heatLifeScale?: number
  readonly smoke: { readonly color: number; readonly count: number; readonly life: number; readonly kind?: 0 | 3 }
  readonly dust: { readonly color: number; readonly count: number }
  readonly shrapnel: { readonly count: number; readonly kind: 0 | 1 | 2 | 3 | 4; readonly speed: number; readonly width?: number; readonly embers?: number }
  readonly chunks: { readonly count: number; readonly colors: readonly number[]; readonly plate?: boolean; readonly hot: number; readonly speed?: number; readonly size?: number }
  readonly mark: { readonly scorch?: number; readonly crater?: number; readonly dent?: number }
  readonly flash: { readonly light: number; readonly life?: number; readonly color?: number; readonly intensity?: number; readonly blinding?: boolean }
  readonly shock?: false | { readonly duration: number }
  readonly shake: number
  readonly push: number
  readonly mushroom?: MushroomSpec
  readonly residualFires?: readonly FireSpec[]
  /** Radius (m) in which characters catch fire. */
  readonly ignite?: number
  /** The pieces that fly are hot (the characters' parts burn). */
  readonly hotParts?: boolean
  readonly cone?: { readonly angle: number; readonly half: number; readonly length: number }
  readonly directionBias?: number
  readonly sources: readonly string[]
}

/** What a host does with what an effect cannot do by itself (break the windows, hurt the characters, dig the ground). */
export type VfxSideRequest =
  | { readonly type: 'crater'; readonly x: number; readonly z: number; readonly radius: number; readonly depth: number }
  | { readonly type: 'ignite'; readonly point: Vec3Like; readonly radius: number }
  | {
      readonly type: 'blast_front'
      readonly explosion: string
      readonly point: Vec3Like
      /** Where the glass breaks, damage and push reach: the Lab's `min(injury, 20) * .85`. */
      readonly glassRadius: number
      /** Metres per second the front travels (the speed of sound): the host delays what it breaks by `distance / speed`. */
      readonly speed: number
      readonly lethal: number
      readonly injury: number
      readonly push: number
      readonly hotParts: boolean
      readonly blinding: boolean
      readonly cone?: { readonly angle: number; readonly half: number; readonly length: number }
    }

export interface VfxProfile {
  readonly puffs: number
  readonly sparks: number
  readonly glows: number
  readonly chunks: number
  readonly sprites: { readonly add: number; readonly normal: number }
  readonly streaks: number
  readonly debris: number
}

export type VfxProfileName = 'low' | 'medium' | 'high'

export interface LodBands {
  /** Distances (m) at which the scale drops. */
  readonly edges: readonly [number, number, number]
  /** The scale in each of the four bands. */
  readonly scales: readonly [number, number, number, number]
  /** How many visual radii are taken off the distance: a big blast stays detailed farther away. */
  readonly radiusFactor: number
}

export interface AreaCap {
  readonly radius: number
  readonly window: number
  readonly count: number
  readonly excessScale: number
}

export interface ScreenState {
  /** Camera shake amplitude (the Lab's `shakeAmp`). */
  shake: number
  /** White flash of the Lab, 0..1, and how fast it fades. */
  flash: number
  flashDecay: number
  white: number
  red: number
  directionLeft: number
  directionRight: number
  chroma: number
  desat: number
  gas: number
  beat: number
}

export interface VfxStats {
  readonly puffs: number
  readonly sparks: number
  readonly glows: number
  readonly chunks: number
  readonly fires: number
  readonly shocks: number
  readonly rings: number
  /** Blast lights and fire lights that are lit. */
  readonly blastLights: number
  readonly fireLights: number
  /** What the last explosion made: puffs, sparks, chunks, lights. */
  readonly lastBlast: { readonly puffs: number; readonly sparks: number; readonly chunks: number; readonly lights: number }
  /** The scale the last explosion was made at (LOD times the area cap). */
  readonly lod: number
  /** Seconds since the last explosion, or `-1` before the first. */
  readonly blastTime: number
}
