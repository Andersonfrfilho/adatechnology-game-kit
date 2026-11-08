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
  /** Which way a thing the effect belongs to is turned, as a unit quaternion `[x, y, z, w]` (the barrel of a weapon, pitch and roll included): an effect written around the thing's own axes follows it. A host that cannot turn an effect fully uses `direction`. */
  readonly orientation?: readonly [number, number, number, number]
  /** Named numbers the effect reads (a size, a length of time, a rate): which ones belong to the effect, and an effect that does not read one ignores it. */
  readonly values?: Readonly<Record<string, number>>
  /**
   * Where the thing the effect belongs to is now, asked every frame while the effect lives (the muzzle of a gun in the hands, which the view turns and the kick
   * moves after the shot): what the effect draws in the thing's own axes (a muzzle flash) and its light stay on it; what it throws free (smoke) stays in the
   * world. `null` leaves the effect where it was last put. A host that cannot move a live effect leaves it at `point`.
   */
  readonly track?: () => EffectPose | null
}

/** A place and a turn in the world: `orientation` as a unit quaternion `[x, y, z, w]`, the same axes as {@link EffectRequest.orientation}. */
export interface EffectPose {
  readonly point: Vec3
  readonly orientation?: readonly [number, number, number, number]
}

/** A box in the frame of an {@link Enclosure}: `center` is the offset from the enclosure's centre along its own axes, `halfSize` half the size along each. */
export interface EnclosureBox {
  readonly center: Vec3
  readonly halfSize: Vec3
  /**
   * How much gets through, as the share per second of what presses on it (a bullet hole: a small number). Absent: it is open, everything passes
   * (an open door, a shattered window, a panel torn off).
   */
  readonly rate?: number
}

/**
 * A closed space that holds out what the air carries (smoke, dust, steam, gas) and holds in what starts inside it: the cabin of a car, a closed room.
 * It is a box turned by `orientation`; what is carried crosses its walls only through `openings`, and through a closed wall only at `leak`
 * (the gaps of a shut door), like a real one. Nothing here is specific to a kind of thing or to a renderer.
 */
export interface Enclosure {
  /** Centre in world space, metres. */
  readonly center: Vec3
  /** Half the size along the box's own axes, metres. */
  readonly halfSize: Vec3
  /** Which way the box is turned, a unit quaternion `[x, y, z, w]` (default not turned). */
  readonly orientation?: readonly [number, number, number, number]
  /** Where the walls are open, in the box's own frame (an opening sticks out through the wall it is in). */
  readonly openings?: readonly EnclosureBox[]
  /** Share per second of what presses on a closed wall that seeps through it (a shut car: about 0.02). Default 0: sealed. */
  readonly leak?: number
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
  /**
   * Declares, moves or ends (`null`) a closed space by the module's own id: the host's smoke, dust and steam go round it and enter only through its
   * openings. A module calls it again whenever the space moves or opens (every frame is fine). A host without it lets smoke through everything.
   */
  enclose?(id: string, enclosure: Enclosure | null): void
  /** Counters of what is alive (`puffs`, `sparks`, `lights`...), for a bench. */
  stats?(): Readonly<Record<string, number>>
  /** The ids `play` accepts. */
  catalog?(): readonly string[]
}
