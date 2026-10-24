import type { ControlValue } from './bench'
import type { Vec3 } from './destruction'

/** What a module asks the host to show: an effect by id (`explosion_m67`, `impact_concrete`, `muzzle_ak`), where, and how. */
export interface EffectRequest {
  /** An id of the host's effect catalogue (`EffectSink.catalog`). A host that does not know it plays nothing. */
  readonly effect: string
  readonly point: Vec3
  /** Where the effect is aimed (a cone, a jet). */
  readonly direction?: Vec3
  /** The surface normal at `point` (an impact, a decal). */
  readonly normal?: Vec3
  /** Makes the visual repeatable: the same seed draws the same effect, so a network event of a few bytes is enough on every client. */
  readonly seed?: number
  /** The variation of the effect (an age, a material, a condition): an option index or an option id of the effect. */
  readonly param?: number | string
  /** Multiplies the effect's size and amount. */
  readonly scale?: number
}

/** Identifies a running effect so it can be stopped. */
export type EffectHandle = number

/**
 * What the host lends a module to show effects (smoke, sparks, blast, blood mist) without bringing its own particles. Nothing here is specific
 * to a kind of effect or to a renderer.
 */
export interface EffectSink {
  /** Starts the effect; `null` when the host does not know it, the layer is off or the budget is spent. */
  play(request: EffectRequest): EffectHandle | null
  /** Ends a looping effect now (a fire, a trail). A handle that already ended is ignored. */
  stop(handle: EffectHandle): void
  /** Sets what the host lets a module tune (`quality`, `lod_band`...): the id of the setting and its value. A host applies the ids it knows. */
  configure?(settings: Readonly<Record<string, ControlValue>>): void
  /** Counters of what is alive (`puffs`, `sparks`, `lights`...), for a bench. */
  stats?(): Readonly<Record<string, number>>
  /** The ids `play` accepts. */
  catalog?(): readonly string[]
}
