import type { Vec3Tuple } from '../workshop/types'

/** What an effect step may hold: literals, or computed fields (`Expr`) resolved when the step runs. Typed loosely on purpose, it is data. */
export type Computed = unknown

export interface EffectParams {
  readonly id: string
  readonly options: readonly string[]
  readonly default: number
}

export interface EffectBudget {
  readonly particles?: number
  readonly debris?: number
  readonly decals?: number
  readonly lights?: number
}

export type ScreenKey = 'shake' | 'white' | 'red' | 'dirL' | 'dirR' | 'chroma' | 'desat' | 'gas' | 'beat'

export type EffectStep =
  | { readonly op: 'burst'; readonly system: 'add' | 'normal' | 'streak'; readonly count: Computed; readonly spawn: Computed }
  | { readonly op: 'spawn'; readonly system: 'add' | 'normal' | 'streak'; readonly spawn: Computed }
  | { readonly op: 'emit'; readonly key: string; readonly system: 'add' | 'normal' | 'streak'; readonly rate: Computed; readonly spawn: Computed }
  | { readonly op: 'debris'; readonly spawn: Computed }
  | { readonly op: 'mesh'; readonly spawn: Computed }
  | { readonly op: 'decal' | 'ring' | 'flash' | 'lens'; readonly args: readonly Computed[] }
  | { readonly op: 'screen'; readonly add?: Readonly<Partial<Record<ScreenKey, Computed>>>; readonly set?: Readonly<Partial<Record<ScreenKey, Computed>>>; readonly max?: Readonly<Partial<Record<ScreenKey, Computed>>> }
  | { readonly op: 'fire_light'; readonly slot: 0 | 1; readonly point: Computed; readonly intensity: Computed; readonly time: Computed }
  | { readonly op: 'fire_light_off'; readonly slot: 0 | 1 }
  | { readonly op: 'cue'; readonly cue: string; readonly args?: Computed; readonly draws?: number }
  | { readonly op: 'call'; readonly macro: string; readonly args: readonly Computed[] }
  | { readonly op: 'at'; readonly time: Computed; readonly steps: readonly EffectStep[] }
  | { readonly op: 'when'; readonly if: Computed; readonly steps: readonly EffectStep[]; readonly otherwise?: readonly EffectStep[] }
  | { readonly op: 'repeat'; readonly count: Computed; readonly steps: readonly EffectStep[] }
  | { readonly op: 'set'; readonly name: string; readonly value: Computed }
  | { readonly op: 'append'; readonly name: string; readonly value: Computed }
  | { readonly op: 'camera'; readonly eye: Computed; readonly target: Computed; /** Puts the camera there at once instead of gliding. */ readonly instant?: boolean }
  | { readonly op: 'post'; readonly values: Readonly<Record<string, Computed>> }
  | { readonly op: 'behavior'; readonly id: string; readonly action: string; readonly args?: Computed }

/**
 * One entry of the Workshop (W449-1244) as data. `setup` and `timeline` run when the effect starts (the page's `setup` and `run`, in that order), `tick`
 * every frame. A step that draws random numbers draws them in the order the page did, which the Workshop golden checks.
 */
export interface EffectDef {
  readonly id: string
  /** The id the Workshop page gave it (`sangue`): the goldens and the inventory find the effect by it. */
  readonly pageId: string
  readonly team: 'creatures' | 'weapons' | 'world' | 'destruction' | 'vehicles' | 'screen'
  readonly params?: EffectParams
  readonly budget: EffectBudget
  /** Seconds of the page's loop; `0` runs until stopped. */
  readonly loop?: number
  readonly view?: { readonly eye: Vec3Tuple; readonly target: Vec3Tuple }
  /**
   * Where the recipe puts the thing the effect is about (the hit, the muzzle, the pool) and which way it points, in the recipe's own space: `play` puts
   * `anchor` at the point it is given and turns `heading` toward its `direction`. Both optional: a recipe written around the origin needs neither.
   */
  readonly anchor?: Vec3Tuple
  readonly heading?: Vec3Tuple
  /** The Lab profile that replaced this Workshop entry in the game (W406: `lab: 1`). */
  readonly lab?: string
  /** The props this effect keeps (a car, walkers, a bottle in flight), by behaviour id. */
  readonly props?: readonly string[]
  readonly setup?: readonly EffectStep[]
  readonly timeline: readonly EffectStep[]
  readonly tick?: readonly EffectStep[]
}

/** Something an effect asks of its owner: move a prop, play a sound. */
export interface CueRequest {
  readonly cue: string
  readonly args: unknown
  readonly time: number
}
