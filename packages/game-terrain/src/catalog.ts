import type { TerrainBlow, TerrainMaterial, TerrainProfile } from './types'

// Specific energies are what the marks of real blows imply: a 500 J pistol round leaves about 120 cm³ in soil and 3 cm³ in concrete, an 800 kJ grenade a 1.3 m crater in soil and a 25 cm spall on a slab.
// Cracks run about a metre from a grenade on a slab and half that on asphalt; a contact charge breaks a reinforced slab right through at about 1 kg of TNT (4.2 MJ) for 12 cm,
// the thickness cubed (the breaching rule of thumb), leaving a hole about one and a half thicknesses wide with the bars across it.
export const TERRAIN_MATERIALS: readonly TerrainMaterial[] = [
  {
    id: 'turf',
    dig: { effort: 1.3 },
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
    dig: { effort: 1 },
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
    dig: { effort: 0.8 },
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
    dig: { effort: 1.6 },
    debris: 'chips',
    rimShare: 0.15,
    reposeDegrees: 38,
    color: [0.27, 0.25, 0.22],
    pattern: 'gravel',
    hits: {
      ballistic: { specificEnergy: 8e6, aspect: 0.4 },
      blunt: { specificEnergy: 8e6, aspect: 0.2, thresholdJoules: 200 },
      slash: { specificEnergy: 3e7, aspect: 0.3, thresholdJoules: 400 },
      explosive: { specificEnergy: 1e7, aspect: 0.35 },
    },
    fire: { maxScorch: 0.3, scorchPerSecond: 0.06 },
    scatters: true,
  },
  {
    id: 'asphalt',
    debris: 'chips',
    color: [0.05, 0.05, 0.055],
    pattern: 'asphalt',
    crack: { reach: 0.6, width: 0.008, thresholdJoules: 800 },
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
    crack: { reach: 1, width: 0.006, thresholdJoules: 300 },
    breach: { joulesPerCubedThickness: 2.4e9, radiusOverThickness: 1.5 },
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
    crack: { reach: 0.5, width: 0.002, thresholdJoules: 40 },
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
    crack: { reach: 0.5, width: 0.004, thresholdJoules: 1000 },
    hits: {
      ballistic: { specificEnergy: 2.5e8, aspect: 0.12, minRadius: 0.015 },
      blunt: { specificEnergy: 5e8, aspect: 0.08, thresholdJoules: 1500 },
      slash: { specificEnergy: 2e9, aspect: 0.2, thresholdJoules: 1500 },
      explosive: { specificEnergy: 4e9, aspect: 0.14 },
    },
    fire: { maxScorch: 0.4, scorchPerSecond: 0.06 },
  },
  {
    id: 'mud',
    // the shovel lifts it, and the hole fills in behind the blade
    dig: { effort: 1.4, closes: true },
    debris: 'clods',
    rimShare: 0.15,
    reposeDegrees: 18,
    color: [0.11, 0.075, 0.04],
    pattern: 'mud',
    hits: {
      ballistic: { specificEnergy: 1.2e6, aspect: 0.7 },
      blunt: { specificEnergy: 3e5, aspect: 0.3, thresholdJoules: 15 },
      slash: { specificEnergy: 5e4, aspect: 0.5 },
      explosive: { specificEnergy: 1.5e6, aspect: 0.4 },
    },
    fire: { maxScorch: 0.15, scorchPerSecond: 0.03 },
    footing: { sink: 0.07, drag: 0.6, prints: true },
    splash: 'mud',
    splats: true,
  },
  {
    id: 'clay',
    dig: { effort: 2.2 },
    debris: 'chips',
    color: [0.47, 0.27, 0.14],
    pattern: 'clay',
    hits: {
      ballistic: { specificEnergy: 1e7, aspect: 0.2, minRadius: 0.03 },
      blunt: { specificEnergy: 1.5e7, aspect: 0.15, thresholdJoules: 100 },
      slash: { specificEnergy: 6e7, aspect: 0.3, thresholdJoules: 30 },
      explosive: { specificEnergy: 8e6, aspect: 0.25 },
    },
    fire: { maxScorch: 0.35, scorchPerSecond: 0.05 },
    cracks: 4,
  },
  {
    // laterite, a soil baked hard (piçarra): no shovel goes in; only a heavy blow or a charge sinks or cracks it
    id: 'laterite',
    debris: 'chips',
    rimShare: 0.2,
    color: [0.36, 0.17, 0.08],
    pattern: 'soil',
    hits: {
      ballistic: { specificEnergy: 5e7, aspect: 0.2, thresholdJoules: 200 },
      blunt: { specificEnergy: 8e7, aspect: 0.1, thresholdJoules: 600 },
      slash: { specificEnergy: 2e8, aspect: 0.1, thresholdJoules: 400 },
      explosive: { specificEnergy: 3e8, aspect: 0.18 },
    },
  },
  {
    id: 'snow',
    dig: { effort: 0.6 },
    debris: 'dust',
    rimShare: 0.4,
    reposeDegrees: 38,
    color: [0.82, 0.85, 0.88],
    pattern: 'snow',
    hits: {
      ballistic: { specificEnergy: 1.5e6, aspect: 1 },
      blunt: { specificEnergy: 3e5, aspect: 0.3, thresholdJoules: 10 },
      slash: { specificEnergy: 5e4, aspect: 0.6 },
      explosive: { specificEnergy: 1.5e6, aspect: 0.5 },
    },
    fire: { maxScorch: 0, scorchPerSecond: 0, burnsAway: 0.015 },
    footing: { sink: 0.08, drag: 0.7, prints: true },
  },
  {
    id: 'cobble',
    debris: 'blocks',
    color: [0.2, 0.19, 0.18],
    pattern: 'cobble',
    hits: {
      ballistic: { specificEnergy: 2.5e8, aspect: 0.12, minRadius: 0.015 },
      blunt: { specificEnergy: 5e7, aspect: 0.12, thresholdJoules: 250 },
      slash: { specificEnergy: 2e9, aspect: 0.2, thresholdJoules: 1500 },
      explosive: { specificEnergy: 1.5e7, aspect: 0.2 },
    },
    fire: { maxScorch: 0.4, scorchPerSecond: 0.06 },
    units: { length: 0.3, width: 0.2, looseJoules: 4000 },
  },
  {
    id: 'paver',
    debris: 'blocks',
    color: [0.36, 0.33, 0.3],
    pattern: 'paver',
    hits: {
      ballistic: { specificEnergy: 1.5e8, aspect: 0.14, minRadius: 0.018 },
      blunt: { specificEnergy: 4e7, aspect: 0.12, thresholdJoules: 150 },
      slash: { specificEnergy: 1e9, aspect: 0.2, thresholdJoules: 800 },
      explosive: { specificEnergy: 1.2e7, aspect: 0.2 },
    },
    fire: { maxScorch: 0.45, scorchPerSecond: 0.08 },
    units: { length: 0.2, width: 0.2, looseJoules: 2500 },
  },
]

/** How far a blow is held back by the water it crosses before it reaches the bed: a round slows fast in water; a blast is pushed down by it. */
const WATER_BLOW_SHARE: Record<TerrainBlow, number> = { ballistic: 0.5, slash: 0.3, blunt: 0.5, explosive: 1 }

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
  { id: 'mud', strata: [{ material: 'mud', thickness: 0.5 }, { material: 'soil', thickness: 1.5 }, { material: 'stone', thickness: 0.5 }] },
  { id: 'gravel_bed', strata: [{ material: 'gravel', thickness: 0.3 }, { material: 'soil', thickness: 1.5 }, { material: 'stone', thickness: 0.5 }] },
  { id: 'dry_clay', strata: [{ material: 'clay', thickness: 0.35 }, { material: 'soil', thickness: 1.5 }, { material: 'stone', thickness: 0.5 }] },
  { id: 'snow', strata: [{ material: 'snow', thickness: 0.3 }, { material: 'soil', thickness: 1.5 }, { material: 'stone', thickness: 0.5 }] },
  { id: 'cobblestone', strata: [{ material: 'cobble', thickness: 0.12 }, { material: 'sand', thickness: 0.06 }, { material: 'gravel', thickness: 0.2 }, { material: 'soil', thickness: 1.2 }] },
  // rock at the surface (an outcrop, a quarry floor): a blast only spalls it and a shot chips it
  // a yard as it is dug: topsoil, the clay under it, rock deep down
  { id: 'yard', strata: [{ material: 'soil', thickness: 0.35 }, { material: 'clay', thickness: 1.6 }, { material: 'stone', thickness: 1 }] },
  // ground baked hard (laterite over rock): no shovel goes in
  { id: 'hardpan', strata: [{ material: 'laterite', thickness: 0.8 }, { material: 'stone', thickness: 1.5 }] },
  { id: 'bedrock', surfacePattern: 'rock', strata: [{ material: 'stone', thickness: 3 }] },
  { id: 'paver_floor', strata: [{ material: 'paver', thickness: 0.08 }, { material: 'sand', thickness: 0.05 }, { material: 'gravel', thickness: 0.15 }, { material: 'soil', thickness: 1.2 }] },
  // a pond deep enough to stand chest-high in: a charge on its bed goes off under the water
  { id: 'pond', water: { liquid: 'water', depth: 1.4, drag: 0.4, blowShare: WATER_BLOW_SHARE }, strata: [{ material: 'mud', thickness: 0.2 }, { material: 'soil', thickness: 1.5 }, { material: 'stone', thickness: 0.5 }] },
  { id: 'shallow_water', water: { liquid: 'water', depth: 0.3, drag: 0.65, blowShare: WATER_BLOW_SHARE }, strata: [{ material: 'mud', thickness: 0.15 }, { material: 'soil', thickness: 1.5 }, { material: 'stone', thickness: 0.5 }] },
]

/** About twelve grenades (200 kJ) on the same spot of bare bars. */
export const DEFAULT_BAR_YIELD_JOULES = 2_400_000

/** A 10 mm bar of CA-50 steel: bare, a mesh of them at 15 cm holds about 450 kg on a spot. */
export const DEFAULT_BAR_DIAMETER = 0.01
export const DEFAULT_BAR_YIELD_PA = 500e6

/** The profile of a floor with nothing else said: a plain slab. */
export const DEFAULT_PROFILE = 'concrete_slab'
