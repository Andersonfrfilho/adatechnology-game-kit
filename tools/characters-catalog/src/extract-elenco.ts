import { extractLiteral } from '@adatechnology/golden-tool/cut-source'

import { SOURCE_PATHS } from './paths'
import { readSource } from './read-source'

export type Profession = {
  readonly n: string
  readonly fem?: number
  readonly sub: string
  readonly skin: number
  readonly hair: { readonly s: string; readonly c: number }
  readonly hat?: { readonly k: string; readonly c: number }
  readonly hand?: string | null
  readonly kit: string
} & Readonly<Record<string, unknown>>

export type InfectionStage = { readonly t: string; readonly skin: number; readonly hunch: number; readonly arms: number }
export type MoveBlend = Readonly<Record<string, number>>
export type CutWeapon = { readonly id: string; readonly n: string; readonly dmg: number; readonly cut: number }

export type ElencoData = {
  readonly professions: readonly Profession[]
  readonly stages: readonly InfectionStage[]
  readonly moves: Readonly<Record<string, MoveBlend>>
  readonly cutWeapons: readonly CutWeapon[]
  readonly below: Readonly<Record<string, readonly string[]>>
  readonly falls: Readonly<Record<string, string>>
  /** Hit points and contact radius of each segment of the tree (`segs`, built per character in the page). */
  readonly segments: Readonly<Record<string, { readonly hp: number; readonly radius?: number }>>
}

const SEGMENT_PATTERNS: Readonly<Record<string, RegExp>> = {
  head: /head:\{node:headG,label:'Cabeça',hp:(\d+),r:([0-9.]+)/,
  torso: /torso:\{label:'Tronco',hp:(\d+)\}/,
  pelvis: /pelvis:\{label:'Quadril',hp:(\d+)\}/,
  upperArm: /'uArm'\+k\]=\{node:a\.g,label:'Braço '\+SIDE\[k\],hp:(\d+),r:([0-9.]+)/,
  forearm: /'fArm'\+k\]=\{node:a\.el,label:'Antebraço '\+SIDE\[k\],hp:(\d+),r:([0-9.]+)/,
  hand: /'hand'\+k\]=\{node:a\.hg,label:'Mão '\+SIDE\[k\],hp:(\d+),r:([0-9.]+)/,
  thigh: /'thigh'\+k\]=\{node:l\.g,label:'Coxa '\+LSIDE\[k\],hp:(\d+),r:([0-9.]+)/,
  shin: /'shin'\+k\]=\{node:l\.kn,label:'Canela e pé '\+LSIDE\[k\],hp:(\d+),r:([0-9.]+)/,
}

const readSegments = (source: string): ElencoData['segments'] =>
  Object.fromEntries(
    Object.entries(SEGMENT_PATTERNS).map(([id, pattern]) => {
      const match = pattern.exec(source)
      if (!match) throw new Error(`characters-catalog: Elenco segment "${id}" not found`)
      return [id, match[2] === undefined ? { hp: Number(match[1]) } : { hp: Number(match[1]), radius: Number(match[2]) }]
    }),
  )

export const extractElenco = (): ElencoData => {
  const source = readSource(SOURCE_PATHS.elenco)
  return {
    professions: extractLiteral(source, 'PROFS'),
    stages: extractLiteral(source, 'STAGES'),
    moves: extractLiteral(source, 'MOVES'),
    cutWeapons: extractLiteral(source, 'WEAPONS'),
    below: extractLiteral(source, 'BELOW'),
    falls: extractLiteral(source, 'FALLS'),
    segments: readSegments(source),
  }
}
