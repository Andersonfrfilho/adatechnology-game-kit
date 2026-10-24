import { readFileSync } from 'node:fs'

import { DECISIONS_PATH } from './paths'

/** A reconciliation choice, with where it comes from and why. */
export type Decision<TValue> = { readonly value: TValue; readonly source: string; readonly reason: string }

type CaseType = 'pistol' | 'rifle' | 'shell' | 'big' | 'tiny'
type RimType = 'rimfire' | 'rimmed' | 'rimless' | 'shell'
type DataSource = 'gallery' | 'arsenal' | 'game' | 'lab' | 'sdk' | 'reference' | 'derived'

export type CartridgeDimensions = {
  readonly caseDiameter: number
  readonly overallLength: number
  readonly caseLength: number
  readonly projectileDiameter: number
}

export type NewCaliberBase = {
  readonly id: string
  readonly label: string
  readonly bulletGrams: number
  readonly muzzleSpeed: number
  readonly dragPer100m: number
  readonly kind: string
  readonly diameter?: number
}

export type CaliberDecision = {
  readonly ammoRow?: Decision<string | null>
  readonly noise: Decision<number>
  readonly caseType?: Decision<CaseType>
  readonly rim?: Decision<RimType>
  readonly sources: Decision<readonly DataSource[]>
  readonly base?: Decision<NewCaliberBase>
  readonly cartridge?: Decision<CartridgeDimensions>
  readonly diameter?: Decision<number>
}

export type ExplosiveSources = {
  readonly gallery?: string
  readonly arsenal?: string
  readonly lab?: string
  readonly game?: string
}

type Seconds = number | readonly [number, number]

export type ExplosiveChainDecision = {
  readonly shot?: Seconds
  readonly fire?: Seconds
  readonly explosion?: Seconds
  readonly shotDamageFraction?: number
}

export type ExplosiveExtras = {
  readonly chain?: ExplosiveChainDecision
  readonly fuse?: number
  readonly mass?: number
  readonly stunSeconds?: number
  readonly cone?: boolean
  readonly fireTemperature?: number
  readonly fireFrom?: 'game' | 'lab'
}

export type ExplosiveDecision = {
  readonly sources: Decision<ExplosiveSources>
  readonly name: Decision<string>
  readonly kind: Decision<string>
  readonly triggers: Decision<readonly string[]>
  readonly extras?: Decision<ExplosiveExtras>
  readonly world?: Decision<{ readonly noise: number; readonly destructionLevel: number }>
  readonly copyOf?: Decision<string>
  readonly energy?: Decision<number>
}

export type ModeChoice = { readonly modes: readonly string[]; readonly burst?: number }

export type LauncherDecision = {
  readonly projectile: string
  readonly disposable: boolean
  readonly speed: number
  readonly kick: number
  readonly reload: number
  readonly reloadSource: string
}

export type Decisions = {
  readonly weaponIds: Readonly<Record<string, Decision<string>>>
  readonly englishNames: Readonly<Record<string, Decision<string>>>
  readonly makers: Decision<readonly string[]>
  readonly arsenalCatalogNames: Readonly<Record<string, Decision<string>>>
  readonly arsenalSheetNames: Readonly<Record<string, Decision<string>>>
  readonly galleryCalibers: Readonly<Record<string, Decision<string>>>
  readonly acceptsCalibers: Readonly<Record<string, Decision<readonly string[]>>>
  readonly calibers: Readonly<Record<string, CaliberDecision>>
  readonly energyScale: Decision<{ anchor: string; anchorLethalRadius: number; anchorEnergy: number; exponent: number }>
  readonly explosives: Readonly<Record<string, ExplosiveDecision>>
  readonly archetypes: Readonly<Record<string, Decision<string>>>
  readonly semiRate: Decision<Readonly<Record<string, number>>>
  readonly cycleSeconds: Decision<Readonly<Record<string, number>>>
  readonly timings: { readonly draw: Decision<number>; readonly clear: Decision<number>; readonly oneByOne: Decision<number> }
  readonly modes: {
    readonly byName: Readonly<Record<string, Decision<ModeChoice>>>
    readonly byFamily: Decision<Readonly<Record<string, readonly string[]>>>
    readonly withRate: Decision<readonly string[]>
    readonly default: Decision<readonly string[]>
  }
  readonly magazine: Readonly<Record<string, Decision<{ magazine: number; tubes: number; chamber: number }>>>
  readonly siblingTimings: Readonly<Record<string, Decision<{ siblingOf: string }>>>
  readonly launchers: Readonly<Record<string, Decision<LauncherDecision>>>
  readonly launcherCommon: Decision<{ minArmDistance: number; backblast: number; backblastHalfAngleDeg: number; recoilBase: string; recoilKickBase: number }>
  readonly flamethrowers: Readonly<Record<string, Decision<{ reload: number; rangeFactor: number }>>>
  readonly m79: Decision<{
    id: string
    name: string
    projectile: string
    length: number
    barrel: number
    emptyMass: number
    mass: number
    speed: number
    kick: number
    recoilBase: string
    backblast: number
  }>
  readonly variants: Readonly<Record<string, Decision<{ of: string; id: string; name: string; caliber: string; capacity: number }>>>
  readonly recoil: Decision<{ rounding: number }>
  readonly conditions: Decision<Readonly<Record<string, string>>>
}

export const loadDecisions = (): Decisions => JSON.parse(readFileSync(DECISIONS_PATH, 'utf8')) as Decisions
