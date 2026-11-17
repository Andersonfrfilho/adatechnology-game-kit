import { JOINT_DEFAULTS } from './materials'
import { SOILS, SOIL_DEFAULTS, layersBetween, profileOf } from './soil'
import type { JointKind, SoilDef, SoilProfile } from './types'

/**
 * A part set in the ground (a pole, a post, the footing of a wall) is held by the soil round its buried base: the deeper and wider the base, and the firmer the soil, the
 * stronger the anchor. These are the defaults; the soils are the data of `src/data/soils.json`.
 */
export const EMBEDMENT_DEFAULTS = {
  /** The soil when the host names none: stiff clay, NBR 6122 basic pressure 200 kPa. */
  soil: 'clay_stiff',
  /** The usual rule for a post or pole: buried a tenth of its height plus this (metres). */
  postShare: 0.1,
  postExtra: 0.6,
  /** The buried base whose anchor has the joint kind's default strength (`JOINT_DEFAULTS`), in `soil`: 20 cm wide, 1 m deep. */
  reference: { width: 0.2, depth: 1 },
} as const

/** How deep a post or pole of this height is buried by the usual rule (a tenth of its height plus 0.6 m). */
export function postEmbedment(height: number): number {
  return EMBEDMENT_DEFAULTS.postShare * height + EMBEDMENT_DEFAULTS.postExtra
}

export interface EmbedmentParams {
  /** Metres of the base below the surface. */
  depth: number
  /** Metres of the base across the push (its width or diameter). */
  width: number
  /** The ground: a soil class id of `SOILS` or a profile (default `EMBEDMENT_DEFAULTS.soil`). */
  soil?: string | SoilProfile
  /** Soil classes besides the built-in ones. */
  soils?: readonly SoilDef[]
}

/**
 * Newtons the ground holds against a buried base pushed sideways: the soil's ultimate bearing (its basic pressure times `SOIL_DEFAULTS.safety`) on the buried face, layer by
 * layer down to its depth. Nothing buried, nothing held.
 */
export function embedmentResistance({ depth, width, soil = EMBEDMENT_DEFAULTS.soil, soils = [] }: EmbedmentParams): number {
  if (depth <= 0 || width <= 0) return 0
  const byId = new Map([...SOILS, ...soils].map((s) => [s.id, s]))
  return layersBetween(profileOf(soil), 0, depth, byId).reduce((sum, layer) => sum + layer.soil.allowableKPa * 1000 * SOIL_DEFAULTS.safety * width * layer.thickness, 0)
}

/**
 * Hit points of the joint that sets a part in the ground with a joint of `kind`: the kind's default strength for the reference base (`EMBEDMENT_DEFAULTS.reference` in its
 * soil), scaled by how much more or less the ground holds this base. A post that barely touches the ground is weak; a deeply buried one is strong.
 */
export function embedmentStrength(kind: JointKind, params: EmbedmentParams): number {
  const reference = embedmentResistance({ ...EMBEDMENT_DEFAULTS.reference, soil: EMBEDMENT_DEFAULTS.soil })
  return (JOINT_DEFAULTS[kind].strength * embedmentResistance(params)) / reference
}
