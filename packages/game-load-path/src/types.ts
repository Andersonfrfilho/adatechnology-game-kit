/**
 * How the load of a part goes down to what it rests on. `nearest`: only to its supports closest to the ground (the Visor de casas 3D's rule). `all`: to
 * every support it is laid on at any distance from the ground (a beam on the beam it frames into, NBR 6118 18.3.7; a slab on its four edges).
 */
export type LoadSharing = 'nearest' | 'all'

/** One support of a part: the index of what it rests on and whether the structure lays it one way (`directed`) or the joint only touches (either way). */
export interface SupportEdge {
  readonly on: number
  readonly directed: boolean
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
}

export interface SupportSolution {
  /** Steps from the ground of each part through what carries (-1: no path). */
  readonly distance: Int32Array
  /** The parts in the order the path reaches them from the ground. */
  readonly reached: readonly number[]
  /** What carries each part's load, by the rule. */
  readonly carriers: ReadonlyMap<number, readonly number[]>
  /** The reached parts with every part before what it rests on: the order the load goes down. */
  readonly order: readonly number[]
}
