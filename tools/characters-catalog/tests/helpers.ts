import { readFileSync } from 'node:fs'

import { buildInputs } from '../src/build'
import type { CatalogInputs } from '../src/build-undead'
import { OUTPUT_PATHS } from '../src/paths'

export const inputs: CatalogInputs = buildInputs()

export const readOutput = <TValue>(key: keyof typeof OUTPUT_PATHS): TValue => JSON.parse(readFileSync(OUTPUT_PATHS[key], 'utf8')) as TValue

/** "0,6 / 1,4" and "1,0 · 0,8 · 0,8" as numbers: the Bestiário writes Brazilian decimals. */
export const numbersIn = (text: string): number[] => (text.match(/\d+(?:,\d+)?/g) ?? []).map((token) => Number(token.replace(',', '.')))

export type TypeRow = {
  readonly id: string
  readonly name: { readonly 'pt-BR': string }
  readonly spawnWeight: number
  readonly requires?: string
  readonly health: number
  readonly speed: { readonly wander: number; readonly chase: number; readonly frenzy?: number; readonly sprint?: number; readonly water?: number }
  readonly damage: number
  readonly biteChance: number
  readonly multipliers: { readonly head: number; readonly torso: number; readonly arms: number; readonly legs: number }
  readonly eye: { readonly color: string }
  readonly abilities: Readonly<Record<string, unknown>>
  readonly gait: Readonly<Record<string, unknown>>
  readonly posture: Readonly<Record<string, unknown>>
}
