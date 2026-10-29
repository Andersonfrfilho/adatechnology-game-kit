import { extractLiteral } from '@adatechnology/golden-tool/cut-source'

import { SOURCE_PATHS } from './paths'
import { readSource } from './read-source'

export type BestiaryType = {
  readonly n: string
  readonly eye: string
  readonly pct: number
  readonly role: string
  readonly hp: number
  readonly spd: string
  readonly dmg: number
  readonly bite: string
  readonly mult: string
  readonly look: string
  readonly ai: string
  readonly spawn: string
  readonly counter: string
  readonly voice: string
  readonly step: string
  readonly dim?: boolean
  readonly blind?: boolean
}

export type GaitProfile = {
  readonly f: number
  readonly a?: number
  readonly k?: number
  readonly arm?: number
  readonly bob?: number
  readonly sway?: number
  readonly drag?: boolean
  readonly crawl?: boolean
  readonly idle?: boolean
  readonly stalk?: boolean
  readonly sniff?: boolean
  readonly leap?: boolean
  readonly listen?: boolean
  readonly eat?: boolean
}

export type BestiaryData = {
  readonly types: readonly BestiaryType[]
  readonly gaits: Readonly<Record<string, GaitProfile>>
  readonly cascade: Readonly<Record<string, number>>
  readonly basePose: Readonly<Record<string, number>>
  readonly skin: readonly number[]
  readonly blood: readonly number[]
  readonly cloth: readonly number[]
  /** The text the page shows (line 2 of the extracted source), where the age table and the infection rule live. */
  readonly visibleText: string
}

export const extractBestiary = (): BestiaryData => {
  const source = readSource(SOURCE_PATHS.bestiary)
  return {
    types: extractLiteral(source, 'Z'),
    gaits: extractLiteral(source, 'GAIT'),
    cascade: extractLiteral(source, 'CASC'),
    basePose: extractLiteral(source, 'BASE'),
    skin: extractLiteral(source, 'SKIN'),
    blood: extractLiteral(source, 'BLOOD'),
    cloth: extractLiteral(source, 'CLOTH'),
    visibleText: source.split('\n')[1] ?? '',
  }
}
