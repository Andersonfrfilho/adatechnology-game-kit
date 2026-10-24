import { readFileSync } from 'node:fs'

import { DECISIONS_PATH } from './paths'

/** A reconciliation choice, with where it comes from and why. */
export type Decision<TValue> = { readonly value: TValue; readonly source: string; readonly reason: string }

export type ProtectionPreset = {
  readonly protectionId: string
  readonly kind: string
  readonly resistance?: number
  readonly blunt?: number
  readonly pass?: number
  readonly consumable?: boolean
  readonly absorbs?: string
  readonly fire?: number
  readonly limbs?: number
}

export type PhysicalPenetration = {
  readonly tissuePerCentimetre: { readonly flesh: number; readonly bone: number }
  readonly torsoPath: { readonly fleshCentimetres: number; readonly boneCentimetres: number }
  readonly regionFactor: { readonly head: number; readonly limb: number; readonly torso: number }
  readonly bruteTorsoFactor: number
  readonly energyKept: string
  readonly points: { readonly coefficient: number; readonly exponent: number }
  readonly tolerance: { readonly bodies: number; readonly energyKept: number }
  readonly calibration: readonly { readonly caliber: string; readonly bodies: number; readonly bestiaryEnergyKept?: number }[]
}

export type Ability = { readonly evidence: string } & Readonly<Record<string, number | boolean | string>>

export type Decisions = {
  readonly typeIds: Decision<Readonly<Record<string, string>>>
  readonly typeNames: Decision<Readonly<Record<string, string>>>
  readonly typeOrder: Decision<readonly string[]>
  readonly typeSpeeds: Decision<{
    readonly benchChaseFrom: readonly string[]
    readonly frenzyFromGameChase: readonly string[]
    readonly runner: { readonly chase: number; readonly sprint: number }
    readonly drownedWater: number
  }>
  readonly drownedSpawn: Decision<{ readonly spawnWeight: number; readonly requires: string }>
  readonly childTypePool: Decision<{ readonly exclude: readonly string[] }>
  readonly woundNames: Decision<Readonly<Record<string, string>>>
  readonly ageIds: Decision<readonly string[]>
  readonly agePerception: Decision<Readonly<Record<string, Readonly<Record<string, number>>>>>
  readonly outfitIds: Decision<readonly string[]>
  readonly protectionPresets: Decision<Readonly<Record<string, ProtectionPreset>>>
  readonly lootPools: Decision<Readonly<Record<string, { readonly item: string; readonly chance: number }>>>
  readonly calibreIds: Decision<Readonly<Record<string, string>>>
  readonly poseIds: Decision<readonly string[]>
  readonly regionIds: Decision<readonly string[]>
  readonly segmentRegions: Decision<Readonly<Record<string, string>>>
  readonly elencoSegmentIds: Decision<Readonly<Record<string, string>>>
  readonly severity: Decision<Readonly<Record<string, number>>>
  readonly defaultCut: Decision<unknown>
  readonly deathRule: Decision<unknown>
  readonly proportions: Decision<{ readonly guide: Readonly<Record<string, number>>; readonly teamGame: string }>
  readonly physicalPenetration: Decision<PhysicalPenetration>
  readonly teamGamePenetration: Decision<{ readonly damageKeptPerBody: number; readonly falloffAtTwiceRange: number; readonly regionCost: Readonly<Record<string, number>> }>
  readonly appearanceVariance: Decision<unknown>
  readonly moments: Decision<{ readonly wander: number; readonly alert: number; readonly scream: number; readonly injured: number; readonly crawlCap: number; readonly water: Readonly<Record<string, number>>; readonly night: number }>
  readonly abilities: Decision<Readonly<Record<string, Ability>>>
  readonly scope: Decision<Readonly<Record<string, readonly string[]>>>
  readonly triangleBudget: Decision<Readonly<Record<string, number>>>
  readonly professionIds: Decision<readonly string[]>
  readonly professionNames: Decision<Readonly<Record<string, string>>>
  readonly professionCarries: Decision<Readonly<Record<string, string>>>
  readonly ageGroups: Decision<readonly { readonly id: string; readonly maxYears: number }[]>
  readonly professionProtection: Decision<Readonly<Record<string, readonly string[]>>>
  readonly accessorySlots: Decision<Readonly<Record<string, string>>>
}

export const loadDecisions = (): Decisions => JSON.parse(readFileSync(DECISIONS_PATH, 'utf8')) as Decisions
