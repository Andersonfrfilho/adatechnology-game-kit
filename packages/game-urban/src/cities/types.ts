import type { FillBlockOptions } from '../block'
import type { Locale } from '../neighbourhoods/types'

export type DistrictKindText = { name: string; description: string }

/**
 * A kind of district: what a patch of the city is. Numbers a game can change; the ids of `zone` and `pattern` point into other catalogues.
 */
export type DistrictKindDef = {
  id: string
  /** Colour on the map (css hex). */
  color: string
  /** Id of a zone of `game-floorplan-residential` / `game-floorplan-commercial` (`zt`, `zc`, `zr1`, ...); null for ground that is not built. */
  zone: string | null
  /** Id of a neighbourhood pattern of `urban.neighbourhoods` (or `financial_district` of `TOWER_PATTERNS`); null for ground that is not built. */
  pattern: string | null
  /** Storeys of the buildings, `[min, max]`. */
  floors: readonly [number, number]
  /** Share of the buildings by use (`commercial`, `residential`, `industrial`, `institutional`, `agricultural`, ...). */
  uses: Readonly<Record<string, number>>
  /** Size of a block in metres; 0 means the kind has no blocks. */
  block: number
  text: Record<Locale, DistrictKindText>
}

export type PlanRect = readonly [x0: number, z0: number, x1: number, z1: number]
export type PlanPoint = readonly [x: number, z: number]

export type PlanDistrict = {
  id: string
  /** Id of a `DistrictKindDef`. */
  kind: string
  rect: PlanRect
  /** Replaces the name of the kind; a string or one string by locale. */
  name?: string | Partial<Record<Locale, string>>
  /** Replaces the storeys of the kind. */
  floors?: readonly [number, number]
  /** Replaces the shares of use of the kind. */
  uses?: Readonly<Record<string, number>>
}

export type PlanLine = {
  id: string
  /** `avenue`, `street`, `highway`, `rail`, `river` or any string a drawer knows. */
  kind: string
  width: number
  points: readonly PlanPoint[]
}

export type PlanLandmark = { kind: string; at: PlanPoint; name?: string | Partial<Record<Locale, string>> }

export type CityScale = 'metropolis' | 'city' | 'town' | 'village' | (string & {})

/**
 * A city plan: districts painted on a map of metres (centre 0,0; x east, z south), roads, rails and rivers, and landmarks.
 * Districts are listed from the outer to the inner one: the LAST district that contains a point wins.
 */
export type CityPlanDef = {
  id: string
  scale: CityScale
  /** Width and depth of the map in metres. */
  size: readonly [w: number, d: number]
  text: Record<Locale, { name: string; description: string }>
  /** Id of another plan to start from: its districts, lines and landmarks come first; a district or line of the same id replaces, a new one appends. */
  extends?: string
  districts: readonly PlanDistrict[]
  lines: readonly PlanLine[]
  landmarks: readonly PlanLandmark[]
}

/** A plan as a game writes it: with `extends`, everything but the id is optional and comes from the parent. */
export type CityPlanInput = { id: string; extends?: string } & Partial<Omit<CityPlanDef, 'id' | 'extends'>>

export type BlockUse = { floors: readonly [number, number]; uses: Readonly<Record<string, number>>; zone: string | null; pattern: string | null }

export type ResolvedDistrict = {
  id: string
  kind: string
  rect: PlanRect
  name: string
  description: string
  color: string
  zone: string | null
  pattern: string | null
  /** Storeys after the district's override, clamped to `[0, maxFloors]`. */
  floors: readonly [number, number]
  uses: Readonly<Record<string, number>>
  block: number
}

/** A block of a district: its centre, its dimensions less the street, and the config a building generator takes. */
export type Block = {
  x: number
  z: number
  size: readonly [w: number, d: number]
  district: string
  building: BlockUse
}

export type CityLayout = {
  id: string
  scale: string
  size: readonly [number, number]
  name: string
  description: string
  districts: ResolvedDistrict[]
  lines: PlanLine[]
  landmarks: (Omit<PlanLandmark, 'name'> & { name?: string })[]
  /** The district at a point; the last one in the list that contains it. */
  districtAt(x: number, z: number): ResolvedDistrict | undefined
  /** The grid of blocks of a district (by the kind's block size), less the cells another district was painted over. */
  blocks(districtId: string, options?: { street?: number }): Block[]
}

export type LayoutOptions = { maxFloors?: number; locale?: Locale }

export type KindStats = { kind: string; area: number; share: number; districts: number }

export type FillBlockCityOptions = Omit<FillBlockOptions, 'shop'> & {
  /** Chance of a ground-floor shop; default the commercial share of the block. */
  shop?: number
  /** Which tower preset gives the storey height of a use: default `{ commercial: 'office', residential: 'residential' }`. */
  storeyPresets?: Readonly<Record<string, string>>
  /** Storey height when no preset applies, metres. Default the residential preset's. */
  storeyHeight?: number
}

