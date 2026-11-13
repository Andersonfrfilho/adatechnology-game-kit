import type { PlanePoint } from './support-hull'

/**
 * How the load of a part goes down to what it rests on. `nearest`: only to its supports closest to the ground, in equal shares (the Visor de casas 3D's
 * rule). `all`: to every support it is laid on at any distance from the ground (a beam on the beam it frames into, NBR 6118 18.3.7; a slab on its four
 * edges), by statics where a lying part rests on two supports apart (the lever rule on its centroid), else by the contact each gives it (`SupportEdge.weight`) over
 * the compliance of its path to the ground (`SupportGraph.stiffness`, `height`).
 */
export type LoadSharing = 'nearest' | 'all'

/** One support of a part: the index of what it rests on and whether the structure lays it one way (`directed`) or the joint only touches (either way). */
export interface SupportEdge {
  readonly on: number
  readonly directed: boolean
  /** How much of the part it bears (the area of their contact): a part's load is shared among its carriers in proportion to it (default 1: equal shares). */
  readonly weight?: number
  /** Where in plan the part bears on it (the centre of their contact): a lying part on two supports apart shares its load between them by statics. */
  readonly at?: PlanePoint
}

/** A structure as the rule reads it: parts by index, what each one rests on, the ground and the parts that carry nothing (partitions). */
export interface SupportGraph {
  readonly size: number
  readonly sharing: LoadSharing
  /** Stands on the ground (or is the ground): where the load path ends. */
  anchored(part: number): boolean
  /** Still part of the structure (not lost, not dropped). */
  active(part: number): boolean
  /** Carries nothing (a partition wall): the load does not go through it. */
  partition(part: number): boolean
  /** What `part` rests on. */
  supportsOf(part: number): readonly SupportEdge[]
  /**
   * Young's modulus of the part (GPa), undefined when unknown. Carriers under one bearing shorten alike, so each takes load in proportion to its contact over
   * the compliance of its path to the ground: an upright part (`upright`) adds its own `height / E` to what is under it (springs in series: a concrete pillar
   * on masonry is no stiffer than the masonry under it), a lying one (a lintel, a beam) is as compliant as its carriers together (in parallel). Used only where
   * every carrier's path is known and none is the ground; otherwise the contact alone shares.
   */
  stiffness?(part: number): number | undefined
  /** Stands up the storey (a pillar, a wall): it shortens by its own stiffness over its height. */
  upright?(part: number): boolean
  /** Height of the part (m), what an upright one shortens over (default 1). */
  height?(part: number): number
  /** Centroid of the part in plan, where its load stands: a lying part on two supports apart shares it by the lever rule. */
  centre?(part: number): PlanePoint
}

export interface SupportSolution {
  /** Steps from the ground of each part through what carries (-1: no path). */
  readonly distance: Int32Array
  /** The parts in the order the path reaches them from the ground. */
  readonly reached: readonly number[]
  /** What carries each part's load, by the rule. */
  readonly carriers: ReadonlyMap<number, readonly number[]>
  /** The share of each part's load each of its carriers takes (same order as `carriers`, summing to 1). */
  readonly shares: ReadonlyMap<number, readonly number[]>
  /** The reached parts with every part before what it rests on: the order the load goes down. */
  readonly order: readonly number[]
}
