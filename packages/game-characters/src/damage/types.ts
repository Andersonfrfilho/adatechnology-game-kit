import type { BodySlot, Hit, SegmentKind } from '@adatechnology/game-contracts'

export type BallisticClass = 'pistol' | 'rifle' | 'buckshot'

/** A `Hit` plus what a body may also use. A plain `Hit` works: every extra field is optional. */
export type BodyHit = Hit & {
  /** Damage points the caller already resolved (a game's own table): the points step is skipped. */
  readonly points?: number
  /** snake_case calibre id (`9x19`): looks the calibre up in the kit's calibre table. */
  readonly caliberId?: string
  /** Metres from the shooter (the skull range of a shotgun, the head blown off at close range). */
  readonly distance?: number
  /** Projectiles in the load (a shotgun: 9). */
  readonly pellets?: number
  /** `false`: the caller resolved the part without a surface point, so no wound opens at `point` (default true). */
  readonly woundAtPoint?: boolean
}

/** A calibre as the body model sees it. Every field is optional; a game's own table (`team-game`) fills them all. */
export type CaliberEntry = {
  readonly id: string
  /** Damage points of a fresh hit (overrides `points = 3.5·E^0.37`). */
  readonly points?: number
  /** Penetration points (the `team-game` model). */
  readonly penetration?: number
  readonly class?: BallisticClass
  /** Metres within which a head hit is lethal; 1 means always (the game's `cranio`). */
  readonly skullRange?: number
  readonly pellets?: number
  /** Metres of full damage; at twice the range the damage is halved (the `team-game` model). */
  readonly effectiveRangeMetres?: number
}

/** A protection item on the body (`ItemDef.protection` of `game-items` maps onto it). */
export type ProtectionLayer = {
  readonly id: string
  readonly slots: readonly BodySlot[]
  /** Against projectiles: `resistance` in penetration units; a stopped projectile does `blunt` of its damage, one that goes through `pass` (default `blunt`). */
  readonly ballistic?: { readonly resistance: number; readonly blunt: number; readonly pass?: number; readonly consumable?: boolean }
  /** Factor on fire damage (a turnout coat: 0.25). */
  readonly fire?: number
  /** Factor on arm and leg damage (a turnout coat: 0.8). */
  readonly limbs?: number
  /** 0..1 against a bite and a scratch (the layered T3 formula). */
  readonly bite?: number
  readonly scratch?: number
}

/** What a projectile is, for the protection and the skull: the force P of the `physical` model, the class and range of a calibre table. */
export type ProjectileInfo = {
  readonly force: number
  readonly class: BallisticClass
  readonly skullRange: number
  readonly pellets: number
  readonly distance: number
}

/** How hard a projectile pushes and what stops it. `physical` (P = √(E·m/A)) is the default; `team-game` replays the game's points. */
export type PenetrationModel = {
  readonly id: string
  /** A protection layer stops the projectile (the projectile then does the layer's `blunt` share). */
  stops(layer: ProtectionLayer, projectile: ProjectileInfo): boolean
  /** A head hit is lethal when the skull is pierced and the points reach the head-kill threshold. */
  piercesSkull(projectile: ProjectileInfo, headResistance: number): boolean
}

/** Numbers of the segment pipeline (the defaults are the design's, from the game, the Elenco and the Arsenal). */
export type SeverityRules = {
  readonly severAtCut: number
  readonly severAtDamageFraction: number
  readonly destroyAtDamageMultiple: number
  readonly limpAtHpFraction: number
  readonly splitAtDamage: number
  readonly headKillDamage: number
  readonly jawChance: number
  readonly jawDamage: number
  readonly headBitDamage: number
  readonly headBitShotgunMetres: number
  readonly stunAtPoints: number
  /** Share of a limb hit that also comes off vitality (Arsenal 0.3, game 0.5 for the crowd regions). */
  readonly limbVitalityShare: number
  readonly regionLimbVitalityShare: number
}

export type BlastRules = {
  /** Least points a segment must take from a blast to be hit at all. */
  readonly minimumPoints: number
  /** A blast this strong on the head blows it off. */
  readonly headDestroyPoints: number
  /** A blast this strong on a segment destroys it when it reaches 0. */
  readonly bigPoints: number
}

export type DeathRule = 'vitality-or-head' | 'head-only'

export type SegmentRuleId = 'kit' | 'arsenal' | 'elenco'

export type DamageRules = {
  readonly deathRule: DeathRule
  /** The segment rule: `kit` (default), or a team page replayed exactly (`arsenal`, `elenco`). */
  readonly segmentRule: SegmentRuleId
  readonly severity: SeverityRules
  readonly blast: BlastRules
  /** Default `cut` by damage type and projectile class. */
  readonly defaultCut: { readonly slash: number; readonly blunt: number; readonly explosive: number; readonly ballistic: Readonly<Record<BallisticClass, number>> }
  /** `points = coefficient · E^exponent` (E in joules). */
  readonly points: { readonly coefficient: number; readonly exponent: number }
  /** Random spread of the points of a blow: ±spread (the Elenco: 0.15). 0 = no draw. */
  readonly spread: number
  /** Per segment kind: hit points, damage multiplier and bleed rate. */
  readonly segments: Readonly<Record<SegmentKind, { readonly hitPoints: number; readonly multiplier: number; readonly bleed: number }>>
  /** Fire on a body: points per second of exposure. */
  readonly burnPointsPerSecond: number
}

/** What the last hit did, for a HUD (hit marker, headshot) and for tests. */
export type HitReport = {
  readonly part?: string
  readonly points: number
  readonly killed: boolean
  readonly headshot: boolean
  /** The projectile went through (the `physical` model): `exitEnergy` is what is left of it. */
  readonly through: boolean
  readonly exitEnergy: number
  /** A protection layer absorbed the hit completely (a helmet). */
  readonly absorbedBy?: string
}
