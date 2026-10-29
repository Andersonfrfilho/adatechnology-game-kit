import { readFileSync } from 'node:fs'

import { extractLiteral } from '@adatechnology/golden-tool'
import { SOURCE_PATHS } from './paths'

export type GameExplosive = {
  readonly letal: number
  readonly fer: number
  readonly fogoRes?: readonly [number, number]
} & Readonly<Record<string, unknown>>

export type GameWeapon = {
  readonly id: string
  readonly nome: string
  readonly cal: string
  readonly cap: number
  readonly rec: number
  readonly recVazio?: number
  readonly porCartucho?: number
}

export type GameData = {
  readonly explosives: Readonly<Record<string, GameExplosive>>
  readonly weapons: readonly GameWeapon[]
  /** Seconds the weapon is busy after switching to it (`inv.cool` on key press). */
  readonly drawSeconds: number
}

const DRAW_PATTERN = /inv\.cur = k; inv\.reload = 0; inv\.cool = ([0-9.]+);/

export const extractGame = (): GameData => {
  const source = readFileSync(SOURCE_PATHS.game, 'utf8')
  const draw = DRAW_PATTERN.exec(source)
  if (!draw) throw new Error('weapons-catalog: weapon switch time not found in the game source')
  return {
    explosives: extractLiteral(source, 'EXP'),
    weapons: extractLiteral(source, 'ARMAS'),
    drawSeconds: Number(draw[1]),
  }
}
