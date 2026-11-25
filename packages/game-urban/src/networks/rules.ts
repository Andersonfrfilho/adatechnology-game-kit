import { deepMerge } from '@adatechnology/game-contracts'
import type { DeepPartial } from '@adatechnology/game-contracts'

import { DEFAULT_NETWORK_LAYOUT } from './layout-rules'
import type { NetworkLayoutRules } from './layout-rules'
import type { AerialClass, BuriedEdgeKind, NetworkSurface } from './types'

/** Lowest point of a conductor over each surface, metres; `null` = the class does not go there. */
export type ClearanceRow = Readonly<Record<NetworkSurface, number | null>>

/** A band of the diversified demand table: up to `consumers` consumers, kVA per consumer at or below the split and above it. */
export type DiversityBand = { readonly consumers: number; readonly low: number; readonly high: number }

export type TransformerRating = { readonly id: string; readonly kva: number }

export type PowerRules = {
  /** Longest service drop, metres (horizontal). */
  readonly dropMaxLength: number
  /** A drop that crosses the street goes straight across: its horizontal direction at most this far from the street's normal, degrees. */
  readonly dropMaxSkew: number
  /** A drop on the pole's own side comes from a pole in front of the lot: its station at most this far past the lot's frontage, metres. */
  readonly dropFrontageSlack: number
  /** Most service drops one pole holds. */
  readonly dropsPerPole: number
  /** Longest low voltage path from the transformer to its farthest node, each way, metres. */
  readonly lvCircuitMaxLength: number
  /** Highest demand over the rating. */
  readonly maxLoading: number
  readonly transformers: readonly TransformerRating[]
  /** Installed load (kVA) that splits the `low` and `high` columns of the demand table. */
  readonly installedSplitKva: number
  /** By number of consumers, ascending; the last band takes any number above. */
  readonly diversity: readonly DiversityBand[]
}

/** Cover of a pipe: from the ground down to its top, metres. */
export type CoverRange = { readonly min: number; readonly max?: number }

export type NetworkRules = {
  readonly clearance: Readonly<Record<AerialClass, ClearanceRow>>
  /** Samples along a span when the catenary is checked. */
  readonly catenarySamples: number
  readonly power: PowerRules
  readonly lighting: { readonly lampKva: number }
  readonly telecom: { readonly dropMaxLength: number }
  /** Least slope of each gravity pipe, m/m. */
  readonly minSlope: Readonly<Record<Extract<BuriedEdgeKind, 'sewer_main' | 'sewer_lateral' | 'storm_gallery' | 'storm_lateral' | 'storm_gutter'>, number>>
  readonly cover: Readonly<Record<BuriedEdgeKind, CoverRange>>
  readonly sewer: {
    /** Deepest invert below the ground before a pumping station is needed. */
    readonly maxDepth: number
    /** Cover of a sewer main under a street with a storm gallery (the main passes under the gallery's laterals). */
    readonly coverUnderGallery: number
    /** A storm gallery this close to a sewer main, metres in plan, puts the main under that street's rule. */
    readonly galleryReach: number
    /** Deepest bottom of a sewer lateral where it crosses a storm gallery (it goes over it). */
    readonly lateralOverGallery: number
    /** Longest sewer main between two manholes. */
    readonly manholeSpacing: number
    /** A pipe that turns more than this, degrees, or meets two others, is a manhole (a PV). */
    readonly turnTolerance: number
    /** A house lateral leaves the street's main at a right angle, within this many degrees. */
    readonly branchMaxSkew: number
  }
  readonly storm: {
    /** Longest gap between two inlets of a kerb, metres. */
    readonly inletSpacing: number
    /** Each corner of a crossing has an inlet within this distance of the crossing's gallery box, metres. */
    readonly cornerReach: number
  }
  /** Least vertical gap between two pipes that cross, and which one goes above (lower rank above). */
  readonly crossing: { readonly separation: number; readonly rank: Readonly<Record<BuriedEdgeKind, number>> }
  /** Underground power (NBR 14039 and NBR 5410, the utilities' duct standards): the clear gap a power duct keeps beside a water, sewer or storm pipe, and the longest duct between two boxes. */
  readonly underground: { readonly parallel: number; readonly boxSpacing: number }
  /** How far a connection node may sit from the point the lot declared, metres. */
  readonly connectionTolerance: number
  /** What `generateNetworks` lays out: spacing, offsets, sags, diameters (the validator reads none of it). */
  readonly layout: NetworkLayoutRules
}

const LOW_VOLTAGE: ClearanceRow = { road: 5.5, sidewalk: 4.5, lot: 3.5 }

/** Brazilian practice (NBR 15688, NBR 9649, NBR 12218 and the utilities' sharing rules), with no brand. Every number is patched by `resolveNetworkRules`. */
export const DEFAULT_NETWORK_RULES: NetworkRules = {
  clearance: {
    power_mv: { road: 7, sidewalk: 6, lot: null },
    power_lv: LOW_VOLTAGE,
    service_drop: LOW_VOLTAGE,
    street_light: LOW_VOLTAGE,
    telecom: { road: 5, sidewalk: 4.5, lot: 3 },
  },
  catenarySamples: 16,
  power: {
    dropMaxLength: 30,
    dropMaxSkew: 30,
    dropFrontageSlack: 0.5,
    dropsPerPole: 4,
    lvCircuitMaxLength: 200,
    maxLoading: 0.8,
    transformers: [
      { id: 't30', kva: 30 },
      { id: 't45', kva: 45 },
      { id: 't75', kva: 75 },
      { id: 't112', kva: 112.5 },
    ],
    installedSplitKva: 5,
    diversity: [
      { consumers: 5, low: 2, high: 3 },
      { consumers: 15, low: 1.5, high: 2.4 },
      { consumers: 30, low: 1.2, high: 2 },
      { consumers: 60, low: 1, high: 1.7 },
      { consumers: Number.POSITIVE_INFINITY, low: 0.9, high: 1.5 },
    ],
  },
  lighting: { lampKva: 0.15 },
  telecom: { dropMaxLength: 30 },
  minSlope: { sewer_main: 0.005, sewer_lateral: 0.01, storm_gallery: 0.005, storm_lateral: 0.005, storm_gutter: 0.005 },
  cover: {
    water_main: { min: 0.6, max: 0.8 },
    water_service: { min: 0.6, max: 0.8 },
    // the design sets no least cover for the lateral, only that it is buried and passes over a gallery (`sewer.lateralOverGallery`)
    sewer_lateral: { min: 0 },
    storm_lateral: { min: 1, max: 1.2 },
    storm_gallery: { min: 1.2 },
    // the gutter is an open channel at the kerb (diameter 0): its bottom only has to stay at or under the ground
    storm_gutter: { min: 0 },
    sewer_main: { min: 0.9 },
    // the duct bank under the sidewalk: low voltage at 0.6 to 1.0 m, telecom under it, medium voltage deepest; the laterals rise to 0.6 m where they reach the lot
    lv_duct: { min: 0.6, max: 1 },
    telecom_duct: { min: 0.6, max: 1.3 },
    mv_duct: { min: 1, max: 1.5 },
    service_lateral: { min: 0.6, max: 1 },
    telecom_lateral: { min: 0.5, max: 1.3 },
    light_cable: { min: 0.6, max: 1 },
  },
  sewer: { maxDepth: 4.5, coverUnderGallery: 1.8, galleryReach: 3, lateralOverGallery: 0.85, manholeSpacing: 80, turnTolerance: 5, branchMaxSkew: 5 },
  storm: { inletSpacing: 60, cornerReach: 15 },
  crossing: { separation: 0.2, rank: {
      storm_gutter: 0,
      water_main: 1,
      water_service: 1,
      // power and telecom under the water and over every sewer and gallery: power never lies under the sewer
      lv_duct: 1.5,
      mv_duct: 1.5,
      telecom_duct: 1.5,
      service_lateral: 1.5,
      telecom_lateral: 1.5,
      light_cable: 1.5,
      sewer_lateral: 2,
      storm_lateral: 3,
      storm_gallery: 3,
      sewer_main: 4,
    },
  },
  underground: { parallel: 0.3, boxSpacing: 50 },
  connectionTolerance: 0.01,
  layout: DEFAULT_NETWORK_LAYOUT,
}

/** The default rules with a game's numbers over them (objects merge, arrays such as the transformers replace). */
export function resolveNetworkRules(patch?: DeepPartial<NetworkRules>): NetworkRules {
  return deepMerge(DEFAULT_NETWORK_RULES, patch)
}

/**
 * kVA of the circuit's consumers by the diversified demand table: the band of their count, the column of each one's installed load. A
 * consumer whose load is not known (a connection without `installedKva`, a lot linked without a meter) counts in the `low` column.
 */
export function diversifiedDemand(installedKva: readonly number[], rules: PowerRules): number {
  if (installedKva.length === 0) return 0
  const band = rules.diversity.find((entry) => installedKva.length <= entry.consumers) ?? rules.diversity[rules.diversity.length - 1]
  if (band === undefined) return 0
  return installedKva.reduce((sum, installed) => sum + (installed <= rules.installedSplitKva ? band.low : band.high), 0)
}

/** The smallest rating whose loading stays within `maxLoading` for this demand, or none. */
export function pickTransformer(demandKva: number, rules: PowerRules): TransformerRating | undefined {
  return [...rules.transformers].sort((a, b) => a.kva - b.kva).find((rating) => demandKva <= rating.kva * rules.maxLoading)
}
