/** A point or a vector as plain numbers, metres (y up). */
export type WaterVec3 = readonly [number, number, number]

/** How one class of round meets the water, for a round that enters straight down at `speed`. Numbers are metres, seconds and metres per second. */
export interface WaterShotProfile {
  /** Speed the numbers are for: a slower round throws less, a faster one a little more. */
  readonly speed: number
  /** Height of the column of water a round entering straight down throws up. */
  readonly columnHeight: number
  /** Radius of that column at its foot. */
  readonly columnRadius: number
  /** Drops of the crown thrown out around the column. */
  readonly drops: number
  /** Speed the crown's drops leave at, slowest and fastest. */
  readonly dropSpeed: readonly [number, number]
  /** Radius of one drop. */
  readonly dropSize: number
  /** Radius the widest ring reaches before it is gone. */
  readonly ringRadius: number
  /** Rings that follow one another out from the point. */
  readonly rings: number
  /** Seconds a ring lives. */
  readonly ringLife: number
  /** Radius of the patch of foam left at the point. */
  readonly foamRadius: number
  /** Seconds the foam lasts. */
  readonly foamLife: number
  /** Metres of water the round crosses to lose 1/e of its speed (a rifle bullet yaws and breaks up within a few tens of centimetres). */
  readonly slowing: number
  /** Bubbles left per metre of the trail under the water. */
  readonly bubblesPerMetre: number
  /** Below this angle to the surface, in degrees, the round skips off the water instead of going in. */
  readonly ricochetBelowDeg: number
}

/** The ids of `WATER_SHOT_PROFILES`; a host may add its own (`patchWaterShotProfiles`). */
export type WaterShotClass = 'rimfire' | 'pistol' | 'magnum' | 'rifle' | 'battle_rifle' | 'sniper' | 'buckshot' | 'birdshot' | 'slug' | 'arrow' | 'fragment' | 'object'

/** How a kind of charge works on water. */
export interface WaterBlastKind {
  /** Share of the charge that acts on the water like a high explosive: 1 for a high explosive, little for a gas or fuel that only burns fast. */
  readonly brisance: number
  /** Width of the column against a high explosive's (a shaped charge throws a narrow jet). */
  readonly columnWidth: number
  /** Fragments that pepper the water around a charge that bursts at or over the surface. */
  readonly fragments: number
  /** Steam and spray against a high explosive's (a fuel fire boils a lot of water into mist). */
  readonly mist: number
  /** The fireball still shows under the water (never for a real charge; a host may want it). */
  readonly fireballUnderwater: boolean
}

/** The kinds of `WATER_BLAST_KINDS`, as `@adatechnology/game-weapons` names them. */
export type WaterBlastKindId = 'blast' | 'fragmentation' | 'shaped_charge' | 'fuel' | 'flash' | 'directional' | 'incendiary'

/** One explosive of the table: its TNT equivalent in kilograms and its kind. */
export interface WaterBlastCharge {
  readonly tnt: number
  readonly kind: string
}

/** A round meeting the water. */
export interface WaterShotParams {
  /** Where the round meets the surface. */
  readonly point: WaterVec3
  /** Unit vector the round travels along. */
  readonly direction: WaterVec3
  /** The class of round (`WATER_SHOT_PROFILES` id) or a profile of its own. */
  readonly profile: string | WaterShotProfile
  /** Speed of the round at the surface; the profile's own when left out. */
  readonly speed?: number
  /** Metres of water under the point (the trail stops at the bed). Default 2. */
  readonly depth?: number
}

/** A charge going off in or over the water. */
export interface WaterBlastParams {
  /** The centre of the burst. */
  readonly point: WaterVec3
  /** Height of the water surface over the point. */
  readonly level: number
  /** Metres of water from the bed to the surface there. */
  readonly depth: number
  /** Id of an explosive of `WATER_BLASTS`; `tnt` and `kind` win over it. */
  readonly explosive?: string
  /** Kilograms of TNT equivalent. */
  readonly tnt?: number
  /** Kind of charge (`WATER_BLAST_KINDS` id). Default `blast`. */
  readonly kind?: string
}

/** What a round did at the water, as `planWaterShot` worked it out. */
export interface WaterShotPlan {
  readonly profile: WaterShotProfile
  /** Degrees between the round's path and the surface. */
  readonly angleDeg: number
  /** The round skipped off: its new direction and the share of its speed it kept. */
  readonly ricochet: { readonly direction: WaterVec3; readonly speedShare: number } | null
  readonly columnHeight: number
  readonly columnRadius: number
  /** Horizontal lean of the column, metres of top offset per metre of height. */
  readonly tilt: readonly [number, number]
  readonly drops: number
  readonly ringRadius: number
  readonly rings: number
  readonly foamRadius: number
  /** Where the round stopped under the water, or met the bed. */
  readonly trailEnd: WaterVec3
  readonly trailLength: number
  /** The round reached the bed with this speed (0 when it stopped in the water or skipped off). */
  readonly bedSpeed: number
}

/** What a charge did at the water, as `planWaterBlast` worked it out. */
export interface WaterBlastPlan {
  readonly tnt: number
  readonly kind: WaterBlastKind
  /** Metres under the surface the charge went off (negative over it). */
  readonly burstDepth: number
  /** The charge went off under the water: no fireball, the water takes the blast. */
  readonly underwater: boolean
  /** The burst was too high over the water to throw any: only the shock ring and the spray. */
  readonly airburst: boolean
  readonly columnHeight: number
  readonly columnRadius: number
  /** Radius of the dome of white water a burst under the surface lifts (0 over it). */
  readonly domeRadius: number
  readonly domeHeight: number
  readonly shockRadius: number
  readonly waveAmplitude: number
  readonly waveSpeed: number
  readonly drops: number
  readonly mist: number
  readonly fragments: number
  readonly foamRadius: number
  readonly bubbles: number
}

/** Upper bound of each pool: past it the oldest record goes. */
export interface WaterEffectsLimits {
  readonly drops: number
  readonly rings: number
  readonly foam: number
  readonly columns: number
  readonly bubbles: number
  readonly mist: number
  readonly waves: number
}

/** The water's response at a point to the waves going through it. */
export interface WaterWaveSample {
  /** Metres the surface stands over its level. */
  readonly height: number
  /** Metres per second a floating body there is pushed with, along x and z. */
  readonly push: readonly [number, number]
}
