import { deepMerge } from '@adatechnology/game-contracts'
import type { DeepPartial } from '@adatechnology/game-contracts'

import type { AerialClass, BuriedEdgeKind, NetworkSurface } from './types'

/** Lowest point of a conductor over each surface, metres; `null` = the class does not go there. */
export type ClearanceRow = Readonly<Record<NetworkSurface, number | null>>

/** A band of the diversified demand table: up to `consumers` consumers, kVA per consumer at or below the split and above it. */
export type DiversityBand = { readonly consumers: number; readonly low: number; readonly high: number }

export type TransformerRating = { readonly id: string; readonly kva: number }

export type PowerRules = {
  /** Longest service drop, metres (horizontal). */
  readonly dropMaxLength: number
  /** Longest low voltage path from the transformer to its farthest node, each way, metres. */
  readonly lvCircuitMaxLength: number
  /** Highest demand over the rating. */
  readonly maxLoading: number
  readonly transformers: readonly TransformerRating[]
  /** Installed load (kVA) that splits the `low` and `high` columns of the demand table. */
  readonly installedSplitKva: number
  /** Installed load of a connection that does not say. */
  readonly defaultInstalledKva: number
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
  readonly minSlope: Readonly<Record<Extract<BuriedEdgeKind, 'sewer_main' | 'sewer_lateral' | 'storm_gallery' | 'storm_lateral'>, number>>
  readonly cover: Readonly<Record<BuriedEdgeKind, CoverRange>>
  /** Deepest sewer invert below the ground before a pumping station is needed. */
  readonly sewer: { readonly maxDepth: number }
  /** Least vertical gap between two pipes that cross, and which one goes above (lower rank above). */
  readonly crossing: { readonly separation: number; readonly rank: Readonly<Record<BuriedEdgeKind, number>> }
  /** How far a connection node may sit from the point the lot declared, metres. */
  readonly connectionTolerance: number
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
    lvCircuitMaxLength: 200,
    maxLoading: 0.8,
    transformers: [
      { id: 't30', kva: 30 },
      { id: 't45', kva: 45 },
      { id: 't75', kva: 75 },
      { id: 't112', kva: 112.5 },
    ],
    installedSplitKva: 5,
    defaultInstalledKva: 4,
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
  minSlope: { sewer_main: 0.005, sewer_lateral: 0.01, storm_gallery: 0.005, storm_lateral: 0.005 },
  cover: {
    water_main: { min: 0.6, max: 0.8 },
    water_service: { min: 0.6, max: 0.8 },
    sewer_lateral: { min: 0.3 },
    storm_lateral: { min: 1, max: 1.2 },
    storm_gallery: { min: 1.2 },
    sewer_main: { min: 0.9 },
  },
  sewer: { maxDepth: 4.5 },
  crossing: { separation: 0.2, rank: { water_main: 1, water_service: 1, sewer_lateral: 2, storm_lateral: 3, storm_gallery: 3, sewer_main: 4 } },
  connectionTolerance: 0.01,
}

/** The default rules with a game's numbers over them (objects merge, arrays such as the transformers replace). */
export function resolveNetworkRules(patch?: DeepPartial<NetworkRules>): NetworkRules {
  return deepMerge(DEFAULT_NETWORK_RULES, patch)
}

/** kVA of the circuit's consumers by the diversified demand table: the band of their count, the column of each one's installed load. */
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
