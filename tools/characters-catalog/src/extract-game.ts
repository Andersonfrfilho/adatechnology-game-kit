import { cutDeclaration, extractLiteral } from '@adatechnology/golden-tool/cut-source'

import { SOURCE_PATHS } from './paths'
import { fromMarker, readSource } from './read-source'

export type GameCategory = {
  readonly id: string
  readonly nome: string
  readonly peso: number
  readonly vida: number
  readonly vel: readonly [number, number]
  readonly dano: number
  readonly bite: number
  readonly mult: readonly [number, number, number, number]
  readonly perc: readonly [number, number, number]
  readonly olho: number
  readonly noite?: number
  readonly crawl?: number
  readonly corpos?: number
  readonly escala?: number
  readonly porte?: number
}

export type GameAge = { readonly nome: string; readonly p: number; readonly sangue: number; readonly vel: number; readonly vida: number; readonly membro: number; readonly cor: number; readonly seco: number }

export type GameOutfit = {
  readonly nome: string
  readonly p: number
  readonly cor: number | null
  readonly colete?: { readonly pistola: number; readonly fuzil: number }
  readonly capacete?: number
  readonly fogo?: number
  readonly membro?: number
  readonly loot?: readonly [string, number]
}

export type GameCaliber = {
  readonly nome: string
  readonly dano: number
  readonly bagos?: number
  readonly pen: number
  readonly alc: number
  readonly ruido: number
  readonly cranio: number
  readonly classe: string
  readonly peso: number
}

export type BestPose = Readonly<Record<string, number | boolean>>

export type GameData = {
  readonly categories: readonly GameCategory[]
  readonly ages: readonly GameAge[]
  readonly outfits: readonly GameOutfit[]
  readonly segments: { readonly cabeca: number; readonly braco: number; readonly perna: number }
  readonly calibers: Readonly<Record<string, GameCaliber>>
  readonly infection: { readonly febre: number; readonly delirio: number; readonly morte: number; readonly reanima: number }
  readonly wounds: Readonly<Record<string, readonly [number, number]>>
  readonly joints: Readonly<Record<string, readonly [number, number, number]>>
  readonly corpses: { readonly max: number; readonly lifeSeconds: number }
  readonly lodDistances: readonly [number, number]
  readonly bestTypes: Readonly<Record<string, BestPose>>
  readonly bestOutfits: Readonly<Record<string, Readonly<Record<string, number | string | boolean>>>>
  readonly civilianColors: readonly number[]
  readonly outfitColors: readonly (number | null)[]
  readonly poseNames: readonly string[]
  readonly walk: { readonly cadenceBase: number; readonly cadencePerSpeed: number; readonly stopBelowSpeed: number; readonly maxSine: number; readonly strideFactor: number; readonly legLengthFactor: number }
  readonly zones: unknown
  readonly nonPlayerCharacters: unknown
}

const CORPSES_PATTERN = /const CORPOS_MAX = (\d+), CORPO_VIDA = (\d+);/
const LOD_PATTERN = /const LOD_D = \[(\d+), (\d+)\];/
const BODY_MARKER = '// ===== Corpo arredondado (Guia de estilo)'
const SEGMENTS_MARKER = '// Segmentos (Guia do corpo)'
const BEST_MARKER = 'const BEST = (() => {'

const POSES_PATTERN = /pose 0 anda\/1 rasteja\/2 caído\/3 ataca\/4 grito\/5 agachado\/6 salto\/7 comendo/

const WALK_CADENCE_PATTERN = /function walkCad\(v\) \{ return ([0-9.]+) \+ ([0-9.]+) \* v; \}/
const WALK_GAIT_PATTERN = /function walkGait\(v, h = 1\) \{ return v < ([0-9.]+) \? 0 : 2 \* Math\.asin\(Math\.min\(([0-9.]+), v \/ \((\d+) \* ([0-9.]+) \* h \* walkCad\(v\)\)\)\); \}/

const matchOrThrow = (source: string, pattern: RegExp, what: string): RegExpExecArray => {
  const match = pattern.exec(source)
  if (!match) throw new Error(`characters-catalog: ${what} not found in the game source`)
  return match
}

const readWalk = (source: string): GameData['walk'] => {
  const cadence = matchOrThrow(source, WALK_CADENCE_PATTERN, 'walkCad')
  const gait = matchOrThrow(source, WALK_GAIT_PATTERN, 'walkGait')
  return {
    cadenceBase: Number(cadence[1]),
    cadencePerSpeed: Number(cadence[2]),
    stopBelowSpeed: Number(gait[1]),
    maxSine: Number(gait[2]),
    strideFactor: Number(gait[3]),
    legLengthFactor: Number(gait[4]),
  }
}

export const extractGame = (): GameData => {
  const source = readSource(SOURCE_PATHS.game)
  const corpses = matchOrThrow(source, CORPSES_PATTERN, 'corpse limits')
  const lod = matchOrThrow(source, LOD_PATTERN, 'LOD distances')
  const best = cutDeclaration(fromMarker(source, BEST_MARKER), 'BEST')
  return {
    categories: extractLiteral(source, 'CATS'),
    ages: extractLiteral(source, 'IDADES'),
    outfits: extractLiteral(source, 'ROUPAS'),
    segments: extractLiteral(fromMarker(source, SEGMENTS_MARKER), 'SEG'),
    calibers: extractLiteral(source, 'CALIBRES'),
    infection: extractLiteral(source, 'INFEC'),
    wounds: extractLiteral(source, 'FERIDA'),
    joints: extractLiteral(fromMarker(source, BODY_MARKER), 'J'),
    corpses: { max: Number(corpses[1]), lifeSeconds: Number(corpses[2]) },
    lodDistances: [Number(lod[1]), Number(lod[2])],
    bestTypes: extractLiteral(best, 'TYPES'),
    bestOutfits: extractLiteral(best, 'OUTFITS'),
    walk: readWalk(source),
    civilianColors: extractLiteral(source, 'CIVIL_COR'),
    outfitColors: extractLiteral(source, 'ROUPA_COR'),
    poseNames: matchOrThrow(source, POSES_PATTERN, 'pose list')[0].split('/').map((entry) => entry.replace(/^pose \d/, '').replace(/^\d /, '').trim()),
    zones: extractLiteral(source, 'ZONES'),
    nonPlayerCharacters: extractLiteral(fromMarker(source, 'const NPC = ['), 'NPC'),
  }
}
