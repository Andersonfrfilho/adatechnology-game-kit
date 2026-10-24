import { extractLiteral } from '@adatechnology/golden-tool/cut-source'

import { SOURCE_PATHS } from './paths'
import { fromMarker, readSource } from './read-source'

export type ArsenalWeapon = { readonly n: string; readonly dmg: number; readonly pel: number }

export type ArsenalBodyData = {
  readonly bleed: Readonly<Record<string, number>>
  readonly multiplier: Readonly<Record<string, number>>
  readonly hitPoints: Readonly<Record<string, number>>
  readonly weapons: Readonly<Record<string, ArsenalWeapon>>
}

const ZOMBIE_MARKER = '/* ---------- zumbi ---------- */'

export const extractArsenalBody = (): ArsenalBodyData => {
  const source = fromMarker(readSource(SOURCE_PATHS.arsenal), ZOMBIE_MARKER)
  return {
    bleed: extractLiteral(source, 'BLEED'),
    multiplier: extractLiteral(source, 'MULT'),
    hitPoints: extractLiteral(source, 'HPS'),
    weapons: extractLiteral(source, 'ZW'),
  }
}
