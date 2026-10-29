import { readFileSync } from 'node:fs'

import { DECISIONS_PATH } from './paths'

/** A reconciliation choice, with where it comes from and why. */
export type Decision<TValue> = { readonly value: TValue; readonly source: string; readonly reason: string }

export type Outbreak = {
  readonly turns: { readonly turnMinutes: { readonly min: number; readonly max: number }; readonly exceptions: Readonly<Record<string, { readonly min: number; readonly max: number }>>; readonly biteInfectsPlayer: boolean; readonly ratBiteInfectionChance: number }
  readonly dies: { readonly deathHours: { readonly min: number; readonly max: number }; readonly carcass: { readonly lureRadiusMetres: number; readonly lureDays: number; readonly vulturesArriveMinutes: number } }
  readonly eating: { readonly rawMeatStaminaLoss: number; readonly rawMeatHours: number }
  readonly evidence: readonly string[]
}

export type Decisions = {
  readonly speciesIds: Decision<Readonly<Record<string, string>>>
  readonly speciesNames: Decision<Readonly<Record<string, string>>>
  readonly groups: Decision<Readonly<Record<string, string>>>
  readonly phases: Decision<Readonly<Record<string, string>>>
  readonly outcomes: Decision<Readonly<Record<string, string>>>
  readonly outbreak: Decision<Outbreak>
  readonly soundRanges: Decision<Readonly<Record<string, { readonly metres: number; readonly evidence: string }>>>
  readonly scope: Decision<Readonly<Record<string, readonly string[]>>>
}

export const loadDecisions = (): Decisions => JSON.parse(readFileSync(DECISIONS_PATH, 'utf8')) as Decisions
