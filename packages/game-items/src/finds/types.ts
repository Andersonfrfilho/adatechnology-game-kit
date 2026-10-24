import type { rng } from '@adatechnology/game-interactables'

/** The seeded generator of the SDK: a function returning floats in [0, 1). */
export type Rng = ReturnType<typeof rng>

/** Per-instance state of a found item. */
export interface FindData {
  /** Effective age in days (food). */
  readonly ageDays?: number
  /** Condition 0..100 (clothing, weapons, tools). */
  readonly condition?: number
  /** Charge 0..1 (batteries). */
  readonly charge?: number
  /** How full 0..1 (a jerrycan). */
  readonly fill?: number
}

/** The shape of the floorplan's `FindStack`; structurally the same, so a provider plugs in without either package importing the other. */
export interface FindStack {
  readonly itemId: string
  readonly count: number
  readonly data?: FindData
}

/** The shape of the floorplan's `FindsQuery`. */
export interface FindsQuery {
  /** Kind of place (`house`, `supermarket`...). */
  place: string
  /** Kind of container (a catalog container id such as `fridge`, or a furniture category). */
  container: string
  /** `normal`, `fortified` or `abandoned` (or a name the rules map to one of them). */
  state: string
  rng: Rng
  /** Outbreak days; 0 is the normal world. */
  day?: number
  region?: string
  /** Footprint of the furniture in m²: sets the count of an explicit pool. */
  footprint?: number
  /** Key of the explicit pool when it differs from `container`. */
  key?: string
}

/** The shape of the floorplan's `FindsProvider`: answers what a container holds; `null` says it does not know the container. */
export interface FindsProvider {
  findsFor(query: FindsQuery): readonly FindStack[] | null
}
