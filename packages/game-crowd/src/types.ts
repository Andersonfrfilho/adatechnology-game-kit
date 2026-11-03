/** What an agent is doing (G 66724 and 67180-67183): the store keeps the number. */
export const STATE = {
  WANDER: 0,
  CHASE: 1,
  GRAB: 2,
  STUNNED: 3,
  CALLING: 4,
  AIRBORNE: 5,
  DORMANT: 6,
  SWELLING: 7,
  SWING: 8,
  EATING: 9,
  PILE_STEP: 10,
  SEEKING_SOUND: 12,
} as const

/** Balance of an agent (physics): a state machine of its own, apart from `STATE`, so the game's behaviour machine stays as it is. */
export const BALANCE = { STANDING: 0, STAGGERING: 1, FALLEN: 2, GETTING_UP: 3, THROWN: 4 } as const

/** Why an agent went down (index `cause - 1` in `stats.physics.falls`). */
export const FALL_CAUSE = { NONE: 0, PRESSURE: 1, SHOVE: 2, TRIP: 3, LANDING: 4, COLLAPSE: 5, BLAST: 6 } as const

/** Body regions of a hit (G 67012): 0 head, 1 torso, 2 left arm, 3 right arm, 4 left leg, 5 right leg. */
export type Region = 0 | 1 | 2 | 3 | 4 | 5

/**
 * Missing parts as bits (G 67010-67045): 1 skull, 2 left arm off, 4 right arm off, 8 left leg off, 16 right leg off, 32 left arm broken, 64 right arm broken,
 * 128 left leg broken, 256 right leg broken, 512 jaw.
 */
export const MISSING = { SKULL: 1, ARM_L: 2, ARM_R: 4, LEG_L: 8, LEG_R: 16, ARM_L_BROKEN: 32, ARM_R_BROKEN: 64, LEG_L_BROKEN: 128, LEG_R_BROKEN: 256, JAW: 512 } as const

/**
 * The type traits: the special moves of a type, read in the game's order. A type without a trait does not have the move. Every number is the game's
 * (`jogo.js` G 67180-67430, the Bestiário table 3.1 and 12.7).
 */
export type CrowdTraits = {
  /** Jumps a low obstacle in the way while chasing (car, yard wall) up to `maxHeight` m (runner, leaper). */
  readonly vaultsLow?: { readonly maxHeight: number; readonly minRise: number; readonly clearance: number; readonly speedFactor: number }
  /** Pounce from `min` to `max` m in line of sight: cooldown, flight time, speed cap, the vertical speeds and the knock-down on landing (leaper). */
  readonly pounce?: { readonly min: number; readonly max: number; readonly cooldown: number; readonly time: number; readonly speedCap: number; readonly lift: number; readonly liftHigh: number; readonly highAbove: number; readonly landRange: number; readonly knock: number }
  /** A heavy swing: chance per attack, wind-up, reach and knock-down (brute). */
  readonly heavySwing?: { readonly chance: number; readonly windUp: number; readonly range: number; readonly knock: number }
  /** Multiplies the damage on doors (brute 3). */
  readonly doorDamage?: number
  /** Seconds stunned by a heavy hit (default `numbers.hitStun`; brute 0.25). */
  readonly hitStun?: number
  /** Only hears: goes to the source of a sound and hits whatever it meets on the way, other agents too (blind). */
  readonly soundSeeker?: { readonly arrive: number; readonly loseChase: number; readonly hitRadius2: number }
  /** Calls the crowd: wind-up, radius, cooldown, the boost it gives the target, and running from the fight afterwards (screamer). */
  readonly caller?: { readonly range: number; readonly windUp: number; readonly radius: number; readonly cooldown: number; readonly boost: number; readonly fleeAbove: number; readonly fleeRange: number }
  /** Sets the target on fire on a hit (charred). */
  readonly burns?: { readonly seconds: number }
  /** Loses a share of its health the first time it enters water (charred 0.7). */
  readonly waterWeak?: { readonly keep: number; readonly cloud: number }
  /** Waits under water and pulls the target down (drowned). */
  readonly submerged?: { readonly depth: number; readonly wake: number; readonly swim: number; readonly surface: number }
  /** Plays dead and wakes close or behind the target, then sprints for a while (stalker). */
  readonly ambush?: { readonly chance: number; readonly wake: number; readonly wakeBehind: number; readonly behindCos: number; readonly sprint: number; readonly sprintSeconds: number; readonly slow: number }
  /** Swells and bursts close to the target: blinds and marks it with a scent (bloater). */
  readonly burst?: { readonly range: number; readonly swell: number; readonly radius: number; readonly blind: number; readonly scent: number; readonly noiseNear: number; readonly noise: number; readonly cloudColor: number; readonly bloodColor: number; readonly bloodDry: number }
  /** Eats corpses: search radius, reach, seconds, how many, what it gains (devourer). */
  readonly eatsCorpses?: { readonly max: number; readonly search: number; readonly reach: number; readonly seconds: number; readonly grabRange: number; readonly health: number; readonly grow: number; readonly rest: number; readonly retry: number; readonly defend: number; readonly approach: number }
  /** Follows the target's blood trail and leads agents of the type `leads` along (sniffer). */
  readonly tracker?: { readonly range: number; readonly leads: string; readonly max: number; readonly leadRadius: number }
  /** Never older than this age index (runner: recent at most). */
  readonly maxAge?: number
  /** The groan sound id (runner `runner_groan`; default `groan`). */
  readonly voice?: string
  /** How much it adds to the target's panic (runner 2.5). */
  readonly panicWeight?: number
  /** Pulls the target into water when it grabs there (drowned). */
  readonly drownGrab?: boolean
  /** Body colour and skin override at birth (charred, drowned). */
  readonly color?: number
  readonly skin?: number
}

/** One type of agent (a zombie type, a cow, a civilian). The undead pack (`undeadCrowdTypes`) gives the 13 types of the game. */
export type CrowdType = {
  readonly id: string
  /** Weight in the draw of an agent without a forced type (0: never drawn). */
  readonly weight: number
  readonly health: number
  readonly speed: { readonly wander: number; readonly chase: number }
  readonly damage: number
  /** Chance per attack to grab (and bite). */
  readonly bite: number
  readonly multipliers: { readonly head: number; readonly torso: number; readonly arms: number; readonly legs: number }
  /** Metres. */
  readonly perception: { readonly sight: number; readonly hearing: number; readonly smell: number }
  readonly crawls?: boolean
  /** Height multiplier (brute 1.42). */
  readonly scale?: number
  /** Build multiplier (bloater 1.35; a scaled type without one is 1.3). */
  readonly build?: number
  /** Body variants of the type for the renderer (walker 4, runner 3, crawler and brute 2, others 1). */
  readonly variants?: number
  readonly eye?: number
  readonly traits?: CrowdTraits
  /** How the body takes a push (physics only; a type without it uses the defaults). */
  readonly balance?: CrowdBalanceTraits
}

export type CrowdBalanceTraits = {
  /** Multiplies the critical pressure (default 1). */
  readonly stability?: number
  /** Chance of tripping when entering a cell with a body (default 0.04). */
  readonly trip?: number
  /** Force of its will against what is in front, in N (default 250). */
  readonly driveForce?: number
  /** False: already on the ground (a crawler). */
  readonly canFall?: boolean
}

/** A blast as the crowd reads it. */
export type CrowdBlast = {
  readonly point: readonly [number, number, number]
  /** J. */
  readonly energy: number
  /** m, how far it hurts. */
  readonly radius: number
  /** m, everything inside dies. */
  readonly lethalRadius?: number
  readonly source?: string
  /** Id of the chain this blast belongs to (game-destruction `chain`), for the counters. */
  readonly chain?: string
}

/** The age of a body (G IDADES): its share, and what it does to speed, health, limbs and senses. */
export type CrowdAge = { readonly id: string; readonly p: number; readonly speed: number; readonly health: number; readonly limb: number; readonly sight: number; readonly hearing: number; readonly blood: number; readonly bloodColor: number; readonly dryColor: number }
/** What a body wears (G ROUPAS): its share, the vest against pistol and rifle classes, a helmet, a limb factor and the colour. */
export type CrowdOutfit = { readonly id: string; readonly p: number; readonly vest?: { readonly pistol: number; readonly rifle: number }; readonly helmet?: boolean; readonly limb?: number; readonly color: number | null }

/** Everything the crowd draws a body from. */
export type CrowdPack = {
  readonly types: readonly CrowdType[]
  readonly ages: readonly CrowdAge[]
  readonly outfits: readonly CrowdOutfit[]
  /** Hit points of the segments, only for dismembering (G `SEG`). */
  readonly segments: { readonly head: number; readonly arm: number; readonly leg: number }
  /** Clothes colours of the outfits without one (G `CIVIL_COR`). */
  readonly palette: readonly number[]
}

/** The calibre of a projectile hit: its class (pistol or rifle, for vests and helmets), the skull distance (1: any) and an id. */
export type CrowdCaliber = { readonly id: string; readonly class: 'pistol' | 'rifle'; readonly skull: number }
export type CrowdHit = { readonly region: Region; readonly amount: number; readonly distance: number; readonly cut?: number; readonly caliber?: CrowdCaliber | null }
export type CrowdDamageResult = { readonly died: boolean; readonly headshot?: boolean }

/**
 * Who the crowd hunts. `game-player`'s `Player` is one as it is; a game with its own player writes a small object with the same names.
 * Reads: `state`. Writes: the verbs, and `state.burnTimer`, `state.blind`, `state.scentTimer`, `state.screamBoost`.
 */
export interface CrowdTarget {
  readonly state: {
    x: number
    z: number
    y: number
    floor: number
    alive: boolean
    turned: boolean
    crouch: boolean
    bleeding: number
    scentTimer: number
    screamBoost: number
    grabbedBy: number
    blind: number
    burnTimer: number
    /** The body's yaw; the view looks the other way (`yaw - π`). */
    yaw: number
  }
  grab(by: number, noJaw?: boolean, drown?: boolean): void
  hurt(amount: number, by?: number): void
  knock(seconds: number): void
  release(): void
}

export type CrowdSoundId = 'groan' | 'runner_groan' | 'scream_hoarse' | 'step' | 'impact' | 'flesh' | 'wood' | (string & {})
export type CrowdEffectId = 'spark' | 'blood' | 'limb' | 'cloud' | 'dust' | (string & {})
export type CrowdMessageId = 'called' | 'burst_hit' | 'swing_knock' | 'pounce_knock' | 'migration' | 'door_broken' | (string & {})

export type CrowdEventMap = {
  sound: { sound: CrowdSoundId; volume: number; position: [number, number, number]; distance: number }
  effect: { effect: CrowdEffectId; point: [number, number, number]; agent?: number; region?: number; severed?: boolean; radius?: number; color?: number; amount?: number; died?: boolean; age?: number }
  message: { id: CrowdMessageId; seconds: number; type?: string }
  spawn: { agent: number; type: string }
  alert: { agent: number }
  kill: { agent: number; type: string; headshot: boolean; x: number; z: number }
  remove: { agent: number; moved: number }
  scream: { agent: number; x: number; z: number }
  fall: { agent: number; cause: number; x: number; z: number; identity: number }
  blasted: { point: [number, number, number]; radius: number; reached: number; killed: number; thrown: number; fallen: number; chain?: string }
}
export type CrowdEventName = keyof CrowdEventMap

/** A body on the ground (G 67062 `CP`). */
export type Corpse = {
  readonly x: number
  readonly z: number
  readonly yaw: number
  readonly height: number
  readonly build: number
  readonly missing: number
  readonly color: number
  /** Body variant of the renderer, -1 for a body that was not an agent (a civilian). */
  readonly variant: number
  readonly skin: number
  readonly seed: number
  readonly named: number
}
