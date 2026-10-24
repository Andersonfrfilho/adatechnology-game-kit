import { extractLiteral } from '@adatechnology/golden-tool/cut-source'

import { SOURCE_PATHS } from './paths'
import { readSource } from './read-source'

/** `[name, spawn weight, chase speed m/s, eye colour]` rows of the Bancada de Hordas (the values P3 turns into the chase state of the slow types). */
export type BenchCategory = readonly [string, number, number, number]

export const extractBench = (): readonly BenchCategory[] => extractLiteral(readSource(SOURCE_PATHS.hordeBench), 'CATS')
