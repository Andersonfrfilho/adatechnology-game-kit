import type { TerrainMaterial, TerrainProfile } from './types'

// Specific energies are what the marks of real blows imply: a 500 J pistol round leaves about 120 cm³ in soil and 3 cm³ in concrete, an 800 kJ grenade a 1.3 m crater in soil and a 25 cm spall on a slab.
export const TERRAIN_MATERIALS: readonly TerrainMaterial[] = [
  {
    id: 'turf',
    debris: 'clods',
    rimShare: 0.25,
    reposeDegrees: 55,
    color: [0.09, 0.2, 0.04],
    pattern: 'grass',
    hits: {
      ballistic: { specificEnergy: 3e6, aspect: 0.6 },
      blunt: { specificEnergy: 2e6, aspect: 0.2, thresholdJoules: 60 },
      slash: { specificEnergy: 3e5, aspect: 0.5 },
      explosive: { specificEnergy: 3e6, aspect: 0.45 },
    },
    fire: { maxScorch: 1, scorchPerSecond: 0.45, flammable: true },
  },
  {
    id: 'soil',
    debris: 'clods',
    rimShare: 0.35,
    reposeDegrees: 40,
    color: [0.2, 0.12, 0.06],
    pattern: 'soil',
    hits: {
      ballistic: { specificEnergy: 4e6, aspect: 0.6 },
      blunt: { specificEnergy: 2e6, aspect: 0.2, thresholdJoules: 60 },
      slash: { specificEnergy: 3e5, aspect: 0.5 },
      explosive: { specificEnergy: 4e6, aspect: 0.45 },
    },
    fire: { maxScorch: 0.6, scorchPerSecond: 0.15 },
  },
  {
    id: 'sand',
    debris: 'dust',
    rimShare: 0.5,
    reposeDegrees: 33,
    color: [0.62, 0.5, 0.3],
    pattern: 'sand',
    hits: {
      ballistic: { specificEnergy: 2.5e6, aspect: 0.5 },
      blunt: { specificEnergy: 1e6, aspect: 0.2, thresholdJoules: 30 },
      slash: { specificEnergy: 1.5e5, aspect: 0.5 },
      explosive: { specificEnergy: 3e6, aspect: 0.35 },
    },
    fire: { maxScorch: 0.2, scorchPerSecond: 0.05 },
  },
  {
    id: 'gravel',
    debris: 'chips',
    rimShare: 0.3,
    reposeDegrees: 38,
    color: [0.27, 0.25, 0.22],
    pattern: 'stone',
    hits: {
      ballistic: { specificEnergy: 8e6, aspect: 0.4 },
      blunt: { specificEnergy: 8e6, aspect: 0.2, thresholdJoules: 200 },
      slash: { specificEnergy: 3e7, aspect: 0.3, thresholdJoules: 400 },
      explosive: { specificEnergy: 1e7, aspect: 0.35 },
    },
    fire: { maxScorch: 0.3, scorchPerSecond: 0.06 },
  },
  {
    id: 'asphalt',
    debris: 'chips',
    color: [0.05, 0.05, 0.055],
    pattern: 'asphalt',
    hits: {
      ballistic: { specificEnergy: 3e7, aspect: 0.2, minRadius: 0.03 },
      blunt: { specificEnergy: 1e8, aspect: 0.1, thresholdJoules: 400 },
      slash: { specificEnergy: 3e8, aspect: 0.2, thresholdJoules: 400 },
      explosive: { specificEnergy: 2e8, aspect: 0.12 },
    },
    fire: { maxScorch: 0.85, scorchPerSecond: 0.1, burnsAway: 0.00005 },
  },
  {
    id: 'concrete',
    debris: 'chips',
    color: [0.33, 0.33, 0.31],
    pattern: 'concrete',
    hits: {
      ballistic: { specificEnergy: 1.5e8, aspect: 0.14, minRadius: 0.018 },
      blunt: { specificEnergy: 3e8, aspect: 0.08, thresholdJoules: 800 },
      slash: { specificEnergy: 1e9, aspect: 0.2, thresholdJoules: 800 },
      explosive: { specificEnergy: 2.7e9, aspect: 0.12 },
    },
    fire: { maxScorch: 0.45, scorchPerSecond: 0.08 },
  },
  {
    id: 'mortar',
    debris: 'chips',
    color: [0.42, 0.4, 0.36],
    pattern: 'plain',
    hits: {
      ballistic: { specificEnergy: 4e7, aspect: 0.2 },
      blunt: { specificEnergy: 8e7, aspect: 0.1, thresholdJoules: 300 },
      slash: { specificEnergy: 3e8, aspect: 0.2, thresholdJoules: 300 },
      explosive: { specificEnergy: 8e8, aspect: 0.14 },
    },
    fire: { maxScorch: 0.45, scorchPerSecond: 0.08 },
  },
  {
    id: 'ceramic',
    debris: 'shards',
    color: [0.72, 0.7, 0.66],
    pattern: 'tile',
    hits: {
      ballistic: { specificEnergy: 8e6, aspect: 0.1, minRadius: 0.05 },
      blunt: { specificEnergy: 1e7, aspect: 0.08, thresholdJoules: 80, minRadius: 0.06 },
      slash: { specificEnergy: 2e8, aspect: 0.1, thresholdJoules: 200, minRadius: 0.03 },
      explosive: { specificEnergy: 1e8, aspect: 0.03, minRadius: 0.12 },
    },
    fire: { maxScorch: 0.5, scorchPerSecond: 0.08 },
  },
  {
    id: 'wood_hard',
    debris: 'splinters',
    color: [0.3, 0.16, 0.07],
    pattern: 'planks',
    hits: {
      ballistic: { specificEnergy: 2.5e7, aspect: 0.35, minRadius: 0.012 },
      blunt: { specificEnergy: 8e7, aspect: 0.1, thresholdJoules: 120 },
      slash: { specificEnergy: 1.5e7, aspect: 0.4, thresholdJoules: 15 },
      explosive: { specificEnergy: 2e8, aspect: 0.1, minRadius: 0.1 },
    },
    fire: { maxScorch: 1, scorchPerSecond: 0.2, burnsAway: 0.0012, flammable: true },
  },
  {
    id: 'stone',
    debris: 'chips',
    color: [0.23, 0.22, 0.2],
    pattern: 'stone',
    hits: {
      ballistic: { specificEnergy: 2.5e8, aspect: 0.12, minRadius: 0.015 },
      blunt: { specificEnergy: 5e8, aspect: 0.08, thresholdJoules: 1500 },
      slash: { specificEnergy: 2e9, aspect: 0.2, thresholdJoules: 1500 },
      explosive: { specificEnergy: 4e9, aspect: 0.14 },
    },
    fire: { maxScorch: 0.4, scorchPerSecond: 0.06 },
  },
]

export const TERRAIN_PROFILES: readonly TerrainProfile[] = [
  { id: 'lawn', strata: [{ material: 'turf', thickness: 0.05 }, { material: 'soil', thickness: 1.5 }, { material: 'stone', thickness: 0.5 }] },
  { id: 'dirt', strata: [{ material: 'soil', thickness: 1.8 }, { material: 'stone', thickness: 0.5 }] },
  { id: 'sand', strata: [{ material: 'sand', thickness: 2.5 }] },
  { id: 'road', strata: [{ material: 'asphalt', thickness: 0.05 }, { material: 'gravel', thickness: 0.25 }, { material: 'soil', thickness: 1.5 }] },
  { id: 'concrete_slab', strata: [{ material: 'concrete', thickness: 0.12, reinforcement: { material: 'steel', cover: 0.03, spacing: 0.15, resistance: 4 } }] },
  { id: 'suspended_slab', drop: 3, strata: [{ material: 'concrete', thickness: 0.12, reinforcement: { material: 'steel', cover: 0.03, spacing: 0.15, resistance: 4 } }] },
  { id: 'tile_floor', strata: [{ material: 'ceramic', thickness: 0.008 }, { material: 'mortar', thickness: 0.03 }, { material: 'concrete', thickness: 0.1, reinforcement: { material: 'steel', cover: 0.03, spacing: 0.15, resistance: 4 } }] },
  { id: 'wood_floor', strata: [{ material: 'wood_hard', thickness: 0.022 }, { material: 'mortar', thickness: 0.03 }, { material: 'concrete', thickness: 0.1, reinforcement: { material: 'steel', cover: 0.03, spacing: 0.15, resistance: 4 } }] },
  { id: 'stone_paving', strata: [{ material: 'stone', thickness: 0.08 }, { material: 'gravel', thickness: 0.2 }, { material: 'soil', thickness: 1.2 }] },
]

/** About twelve grenades (200 kJ) on the same spot of bare bars. */
export const DEFAULT_BAR_YIELD_JOULES = 2_400_000

/** The profile of a floor with nothing else said: a plain slab. */
export const DEFAULT_PROFILE = 'concrete_slab'
