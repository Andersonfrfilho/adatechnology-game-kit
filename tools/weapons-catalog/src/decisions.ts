import { readFileSync } from 'node:fs'

import { DECISIONS_PATH } from './paths'

/** A reconciliation choice, with where it comes from and why. */
export type Decision<TValue> = { readonly value: TValue; readonly source: string; readonly reason: string }

type CaseType = 'pistol' | 'rifle' | 'shell' | 'big' | 'tiny'
type RimType = 'rimfire' | 'rimmed' | 'rimless' | 'shell'
type Propellant = 'smokeless' | 'black_powder' | 'none'
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
  readonly propellant?: Decision<Propellant>
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
  readonly fuseRange?: readonly [number, number]
  readonly fuseLength?: number
  readonly burnRate?: number
  readonly burnTolerance?: number
  readonly tripwire?: { readonly length: number; readonly angleDeg?: number; readonly height?: number }
  readonly mass?: number
  readonly stunSeconds?: number
  readonly cone?: boolean
  readonly fireTemperature?: number
  readonly fireFrom?: 'game' | 'lab'
  readonly leak?: { readonly fluid: string; readonly liters: number; readonly pressurized?: boolean; readonly igniteDelay?: number; readonly hissSeconds?: number }
  readonly shell?: { readonly launchSpeed: number; readonly trailSeconds?: number }
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

export type StockKind = 'fixed' | 'fold' | 'retract' | 'fold_retract' | 'none'

export type StockDecision = {
  readonly kind?: StockKind
  readonly foldAxis?: 'right' | 'left' | 'under' | 'over'
  /** Metres with the stock folded or slid in, when the Arsenal sheet has none. */
  readonly lengthCollapsed?: number
}

export type MountChoice = { readonly kind: string; readonly interfaces: readonly string[]; readonly length?: number }

export type IntegralChoice = { readonly id: string; readonly mount: string; readonly interfaces: readonly string[] }

export type EffectChoice = {
  readonly stat: string
  readonly mul?: number
  readonly add?: number
  readonly set?: number
  readonly when?: string
  /** Text of the Arsenal §11 line this number comes from; checked against the source, left out of the output. */
  readonly from?: string
}

export type AttachmentChoice = Readonly<Record<string, unknown>> & {
  readonly effects: readonly EffectChoice[]
  readonly sources: readonly DataSource[]
  /** The name of the Arsenal §11 line it implements. */
  readonly arsenal?: string
}

export type UnderbarrelLauncherDecision = {
  readonly id: string
  readonly name: string
  readonly projectile: string
  readonly length: number
  readonly barrel: number
  readonly emptyMass: number
  readonly mass: number
  readonly speed: number
  readonly kick: number
  readonly recoilBase: string
  readonly backblast: number
  /** The Arsenal row whose reload time the launcher takes (the M79: both load a 40 mm grenade by hand). */
  readonly reloadFrom: string
}

export type NumberNote = { readonly source: DataSource | 'owner'; readonly reason: string }

/** A weapon the team pages do not have: a Gallery-style row (measures in mm and kg) built from public data, with where each number comes from. */
export type NewWeaponDecision = {
  readonly id: string
  readonly name: string
  /** Gallery weapon whose category, builder and model options this one starts from; `options` are laid over them. */
  readonly of?: string
  /** Gallery category code (`smg`, `fuz`, `mtr`, `pis`...); defaults to the one of `of`. */
  readonly category?: string
  readonly builder?: string
  readonly caliber: string
  /** The calibre as the model entry names it (`9×19`). */
  readonly caliberText: string
  /** Gallery capacity text: `30/15` is a 30 round magazine with a 15 round option, `12+1` is magazine plus chamber. */
  readonly capacity: string
  readonly length: number
  readonly barrel: number
  readonly emptyMass: number
  readonly options?: Readonly<Record<string, string | number | boolean>>
  /** Weapon whose Arsenal reload times this one takes. */
  readonly reloadFrom: string
  readonly muzzleSpeed?: number
  readonly noise?: number
  readonly modes?: ModeChoice
  readonly spin?: { readonly upSeconds: number; readonly holdSeconds: number }
  readonly rpmRange?: readonly [number, number]
  /** Where each number of the row comes from (`length`, `barrel`, `emptyMass`, `rpm`, `capacity`, `reload`, and `muzzleSpeed`/`noise`/`spin` when set). */
  readonly numbers: Readonly<Record<string, NumberNote>>
}

export type Decisions = {
  /** Weapons made from public data (or ported from a one-line mention in a team page), by the name of their row. */
  readonly creations: Readonly<Record<string, Decision<NewWeaponDecision>>>
  /** The GP-25 goes on AK weapons only: the model option that marks one. */
  readonly gp25Mount: Decision<{ readonly requiresOption: string }>
  /** Grenade launchers that go under a barrel, by id. */
  readonly underbarrelLaunchers: Readonly<Record<string, Decision<UnderbarrelLauncherDecision>>>
  /** Thread of the muzzle by weapon id: what a suppressor or a brake screws on. */
  readonly threads: Readonly<Record<string, Decision<{ readonly interface: string }>>>
  /** Places the Gallery options do not show, by weapon id (§06 notes, §17 slots, grenade launcher mounts). */
  readonly mountNotes: Readonly<Record<string, Decision<{ readonly mounts: readonly MountChoice[] }>>>
  readonly stocks: Readonly<Record<string, Decision<StockDecision>>>
  readonly attachments: Readonly<Record<string, Decision<AttachmentChoice>>>
  /** Accessories that are part of the weapon and cannot come off. */
  readonly integral: Readonly<Record<string, Decision<readonly IntegralChoice[]>>>
  /** Lines of Arsenal §11 that are not accessories, with where they live instead. */
  readonly arsenalFeatures: Decision<Readonly<Record<string, string>>>
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
  readonly modelChambers: Decision<{ readonly default: number }>
  readonly reliability: Readonly<Record<string, Decision<number>>>
}

export const loadDecisions = (): Decisions => JSON.parse(readFileSync(DECISIONS_PATH, 'utf8')) as Decisions
