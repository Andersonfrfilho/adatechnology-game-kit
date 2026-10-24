export type LocaleId = 'en' | 'pt-BR'

export type UndeadTypeText = { readonly role: string; readonly ai: string; readonly counter: string; readonly voice: string }

export type UndeadType = {
  readonly id: string
  readonly name: Readonly<Record<LocaleId, string>>
  readonly spawnWeight: number
  /** Spawns only where this holds (`water` for the drowned). */
  readonly requires?: string
  /** Share of this type among the night spawns, 0..1. */
  readonly nightShare?: number
  readonly health: number
  /** Metres per second by moment: `wander`, `chase`, plus `sprint`, `frenzy` or `water` for the types that have them. */
  readonly speed: Readonly<Record<string, number>>
  readonly damage: number
  readonly biteChance: number
  /** Damage multipliers by body group. */
  readonly multipliers: { readonly head: number; readonly torso: number; readonly arms: number; readonly legs: number }
  /** Metres. */
  readonly perception: { readonly sight: number; readonly hearing: number; readonly smell: number }
  /** Eye colour as `RRGGBB` (v17 of the game), with `dim` or `blind` for the types whose eyes do not glow. */
  readonly eye: { readonly color: string; readonly dim?: boolean; readonly blind?: boolean }
  readonly scale?: number
  readonly build?: number
  /** How many bodies the type counts for in the horde. */
  readonly bodyCount?: number
  readonly crawls?: boolean
  /** `false` for the types a child never turns into (brute, bloater). */
  readonly childEligible?: boolean
  /** Rest pose: shoulders, arms, legs and head angles in radians. */
  readonly posture: Readonly<Record<string, number>>
  /** Walk cycle: frequency, amplitude, knee, arm swing and the flags of the type. */
  readonly gait: Readonly<Record<string, number | boolean>>
  /** Ability parameters; the behaviour is the game's. */
  readonly abilities: Readonly<Record<string, number | boolean | string>>
  readonly text: Readonly<Partial<Record<LocaleId, UndeadTypeText>>>
}

export type UndeadAge = {
  readonly id: string
  readonly name: Readonly<Partial<Record<LocaleId, string>>>
  readonly probability: number
  /** Blood factor: 1 fresh, 0 dried out. */
  readonly blood: number
  /** Speed multiplier. */
  readonly speed: number
  /** Health multiplier. */
  readonly health: number
  /** Damage multiplier on the limbs. */
  readonly limbDamage: number
  readonly freshBloodColor: string
  readonly dryBloodColor: string
  readonly perception: Readonly<Record<string, number>>
}

export type UndeadAges = {
  readonly ages: readonly UndeadAge[]
  readonly skinTones: readonly string[]
  readonly bloodTones: readonly string[]
  readonly clothTones: readonly string[]
}

export type UndeadOutfit = {
  readonly id: string
  readonly name: Readonly<Partial<Record<LocaleId, string>>>
  readonly probability: number
  readonly color: string | null
  /** Item ids of `game-items` protection (`vest_police`, `helmet_combat`...). */
  readonly protection: readonly string[]
  readonly vest?: { readonly pistol: number; readonly rifle: number }
  readonly helmet?: boolean
  readonly fire?: number
  readonly limbs?: number
  readonly loot?: { readonly caliber: string; readonly chance: number }
}

export type WoundKind = 'scratch' | 'laceration' | 'bite'

export type InfectionStage = {
  readonly name: Readonly<Partial<Record<LocaleId, string>>>
  readonly fromHours?: number
  readonly toHours?: number
  readonly skin: number
  readonly hunch: number
  readonly arms: number
}

export type UndeadInfection = {
  readonly wounds: Readonly<Record<WoundKind, { readonly share: number; readonly infectionChance: number }>>
  readonly accelerated: { readonly feverSeconds: number; readonly deliriumSeconds: number; readonly deathSeconds: number; readonly reanimateSeconds: number }
  readonly stages: readonly InfectionStage[]
  readonly alternatives: Readonly<Record<string, number>>
}

export type UndeadMoments = {
  readonly wander: number
  readonly alert: number
  readonly scream: number
  readonly injured: number
  readonly crawlCap: number
  readonly water: { readonly drowned: number; readonly others: number }
  readonly night: number
}

export type UndeadLocale = {
  readonly typeText: Readonly<Record<string, UndeadTypeText>>
  readonly ages: Readonly<Record<string, string>>
  readonly outfits: Readonly<Record<string, string>>
  readonly stages: readonly string[]
  readonly wounds: Readonly<Record<WoundKind, string>>
}
