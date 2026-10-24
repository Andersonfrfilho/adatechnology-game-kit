import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

import { SOURCE_PATHS } from './paths'

/** One entry of a house container pool (`LT(tipo, nome, min, max, categoria, pegavel, peso)` in the viewer). */
export type HousePoolEntry = {
  readonly tipo: string
  readonly nome_pt: string
  readonly qtd: readonly [number, number]
  readonly categoria: string
  readonly pegavel: boolean
  readonly peso: number
}

export type HousePools = Readonly<Record<string, readonly HousePoolEntry[]>>

/** `COMIDA_SUP`: the entry categories a fortified house stocks up on. */
export type HouseData = { readonly pools: HousePools; readonly supplyCategories: readonly string[] }

const EVALUATION_TIMEOUT_MS = 2000

/** From the `LT` helper to the line before `COMIDA_SUP`: the `CONTEUDO` table and the container aliases that follow it. */
const cutPoolBlock = (source: string): string => {
  const start = source.search(/^const LT = /m)
  const end = source.search(/^const COMIDA_SUP = /m)
  if (start < 0 || end < start) throw new Error('items-catalog: CONTEUDO block not found in the house viewer source')
  return source.slice(start, end)
}

export const extractVc3 = (): HouseData => {
  const source = readFileSync(SOURCE_PATHS.houseViewer, 'utf8')
  const supply = /^const COMIDA_SUP = (\[[^\]]*\]);/m.exec(source)
  if (!supply) throw new Error('items-catalog: COMIDA_SUP not found in the house viewer source')
  return {
    pools: runInNewContext(`${cutPoolBlock(source)}\nCONTEUDO`, {}, { timeout: EVALUATION_TIMEOUT_MS }) as HousePools,
    supplyCategories: runInNewContext(supply[1] ?? '[]', {}, { timeout: EVALUATION_TIMEOUT_MS }) as string[],
  }
}
