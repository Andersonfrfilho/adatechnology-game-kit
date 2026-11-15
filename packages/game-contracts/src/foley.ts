/**
 * The sounds of a body (footsteps, jumps, landings, blows, hurt), as ids every package agrees on: the rule that knows what the body did
 * (`game-player`, a host's own player) names the sound, and the bank that knows how it sounds (`game-audio`'s `BODY_FOLEY_BANK`) answers it.
 * A game swaps the sound of an id (a sample instead of the synthesis) without touching the rule.
 */

/** What the feet touch, by how it sounds (not by what it is made of: a wooden floor and a plywood board both sound `wood`). */
export const SURFACE_IDS = ['concrete', 'asphalt', 'wood', 'tile', 'dirt', 'grass', 'gravel', 'sand', 'metal', 'water', 'glass', 'carpet'] as const
export type SurfaceId = (typeof SURFACE_IDS)[number]

/** The surface a body stands on when nobody says (the test room's floor is a concrete slab). */
export const DEFAULT_SURFACE: SurfaceId = 'concrete'

/** How the feet move: a run hits harder and shorter; a crouched step is the walk, quieter. */
export const GAIT_IDS = ['walk', 'run'] as const
export type GaitId = (typeof GAIT_IDS)[number]

/** How hard a landing is: `light` for a jump on the spot or a step down (up to about 5 m/s), `heavy` for a drop of more than a metre and a half. */
export const LANDING_IDS = ['light', 'heavy'] as const
export type LandingId = (typeof LANDING_IDS)[number]

/** The fall speed (m/s) from which a landing is `heavy`. */
export const HEAVY_LANDING_SPEED = 5.5

export type FootstepSoundId = `footstep_${SurfaceId}_${GaitId}`
export type LandSoundId = `land_${SurfaceId}_${LandingId}`

/**
 * How a blow is struck, by the body part or the tool that does it. `blade` stabs or slashes, `blunt` is a club, a bat, a pipe or a hammer, `chop` an
 * axe or a machete driven down.
 */
export const BLOW_IDS = ['punch', 'kick', 'shove', 'blade', 'blunt', 'chop'] as const
export type BlowId = (typeof BLOW_IDS)[number]

/** What the blow meets: a body (flesh and bone, the head apart), something else (the material answers with its own impact), or nothing. */
export type BlowTarget = 'body' | 'head' | 'object' | 'air'

/** The sounds of the body that are not a footstep or a landing. */
export const BODY_SOUND_IDS = [
  'jump',
  'cloth_rustle',
  'body_fall',
  'fall_damage',
  'player_hurt',
  'player_breath_run',
  'player_death',
  'bite',
  'grab',
  'punch_swing',
  'punch_hit_body',
  'punch_hit_face',
  'punch_hit_object',
  'kick_swing',
  'kick_hit',
  'kick_hit_object',
  'shove_two_hands',
  'knife_swing',
  'knife_stab',
  'knife_slash',
  'knife_hit_object',
  'blunt_swing',
  'blunt_hit',
  'blunt_hit_object',
  'axe_swing',
  'axe_chop',
  'axe_hit_object',
] as const
export type BodySoundId = (typeof BODY_SOUND_IDS)[number]

/** Every sound of a body: what a host plays for the player, a survivor or a zombie. */
export type BodyFoleyId = FootstepSoundId | LandSoundId | BodySoundId

export const footstepSoundId = (surface: SurfaceId, gait: GaitId): FootstepSoundId => `footstep_${surface}_${gait}`
export const landSoundId = (surface: SurfaceId, fallSpeed: number): LandSoundId => `land_${surface}_${fallSpeed >= HEAVY_LANDING_SPEED ? 'heavy' : 'light'}`

/** Every footstep and landing id, in the order of the surfaces. */
export const FOOTSTEP_SOUND_IDS: readonly FootstepSoundId[] = SURFACE_IDS.flatMap((surface) => GAIT_IDS.map((gait) => footstepSoundId(surface, gait)))
export const LAND_SOUND_IDS: readonly LandSoundId[] = SURFACE_IDS.flatMap((surface) => LANDING_IDS.map((landing): LandSoundId => `land_${surface}_${landing}`))
export const BODY_FOLEY_IDS: readonly BodyFoleyId[] = [...FOOTSTEP_SOUND_IDS, ...LAND_SOUND_IDS, ...BODY_SOUND_IDS]

const SWING: Readonly<Record<BlowId, BodySoundId | null>> = {
  punch: 'punch_swing',
  kick: 'kick_swing',
  // two hands pushed out do not whistle: the shove is one sound, at the contact
  shove: null,
  blade: 'knife_swing',
  blunt: 'blunt_swing',
  chop: 'axe_swing',
}

/**
 * Seconds from the start of a swing's sound to its loudest point (the limb or the tool at full speed, just before the contact). A host that knows when the
 * blow lands starts the swing this long before; one that does not plays the swing now and the hit this long after.
 */
export const SWING_LEAD_SECONDS: Readonly<Record<BlowId, number>> = { punch: 0.07, kick: 0.09, shove: 0, blade: 0.05, blunt: 0.1, chop: 0.11 }

/** The swing through the air, played as the blow starts (`null`: the blow has none). */
export const swingSoundId = (blow: BlowId): BodySoundId | null => SWING[blow]

const HIT: Readonly<Record<BlowId, Readonly<Record<Exclude<BlowTarget, 'air'>, BodySoundId>>>> = {
  punch: { body: 'punch_hit_body', head: 'punch_hit_face', object: 'punch_hit_object' },
  kick: { body: 'kick_hit', head: 'kick_hit', object: 'kick_hit_object' },
  shove: { body: 'shove_two_hands', head: 'shove_two_hands', object: 'shove_two_hands' },
  blade: { body: 'knife_stab', head: 'knife_stab', object: 'knife_hit_object' },
  blunt: { body: 'blunt_hit', head: 'blunt_hit', object: 'blunt_hit_object' },
  chop: { body: 'axe_chop', head: 'axe_chop', object: 'axe_hit_object' },
}

/**
 * The body's side of a blow that lands: the knuckles, the shoe, the blade or the club meeting what it hit. On an object the material's own impact
 * plays too (the wood, the metal); this is the part that says it was a punch and not a shot.
 */
export const hitSoundId = (blow: BlowId, target: Exclude<BlowTarget, 'air'>): BodySoundId => HIT[blow][target]

/**
 * The surface a material sounds like underfoot, by the material ids of `game-destruction` and `game-terrain` (unknown ids: `fallback`). Data, so
 * a game with its own materials passes its own table to `surfaceOfMaterial`.
 */
export const MATERIAL_SURFACES: Readonly<Record<string, SurfaceId>> = {
  concrete: 'concrete',
  mortar: 'concrete',
  stone: 'concrete',
  brick: 'concrete',
  cobble: 'concrete',
  paver: 'concrete',
  plaster: 'concrete',
  asphalt: 'asphalt',
  wood_soft: 'wood',
  wood_hard: 'wood',
  green_wood: 'wood',
  plywood: 'wood',
  mdf: 'wood',
  ceramic: 'tile',
  plastic: 'tile',
  soil: 'dirt',
  mud: 'dirt',
  clay: 'dirt',
  laterite: 'gravel',
  wax: 'dirt',
  flesh_fruit: 'dirt',
  turf: 'grass',
  foliage: 'grass',
  cactus: 'grass',
  gravel: 'gravel',
  sand: 'sand',
  // no snow surface yet: packed snow crunches closest to sand underfoot
  snow: 'sand',
  steel: 'metal',
  cast_iron: 'metal',
  aluminium: 'metal',
  copper: 'metal',
  water: 'water',
  glass: 'glass',
  tempered_glass: 'glass',
  fabric: 'carpet',
  foam: 'carpet',
  leather: 'carpet',
  rubber: 'carpet',
  paper: 'carpet',
}

export const isSurfaceId = (value: unknown): value is SurfaceId => typeof value === 'string' && (SURFACE_IDS as readonly string[]).includes(value)

/** The surface of a material id; a surface id passes through. */
export function surfaceOfMaterial(material: string | undefined, table: Readonly<Record<string, SurfaceId>> = MATERIAL_SURFACES, fallback: SurfaceId = DEFAULT_SURFACE): SurfaceId {
  if (material === undefined) return fallback
  if (isSurfaceId(material)) return material
  return table[material] ?? fallback
}
