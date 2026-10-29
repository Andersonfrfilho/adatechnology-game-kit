import { cutBetween, cutDeclaration, cutFunction, evaluateSlice } from '@adatechnology/golden-tool/cut-source'

import { SOURCE_PATHS } from '../paths'
import { fromMarker, readSource } from '../read-source'

const CORE_MARKER = '// ===== Núcleo: render, entrada, som, utilidades ====='
const SEGMENTS_MARKER = '// Segmentos (Guia do corpo)'
const HORDE_MARKER = '// ===== Horda: simulação com relevância (R0..R3), percepção, combate, corpos ====='
const SMALL_ZOMBIE_CAPACITY = 8

/** The game's rule data, cut from the game and evaluated as is. */
const rulesCode = (source: string): string =>
  [
    cutDeclaration(source, 'CATS'),
    cutDeclaration(source, 'CAT'),
    cutDeclaration(source, 'IDADES'),
    cutDeclaration(source, 'ROUPAS'),
    cutDeclaration(fromMarker(source, SEGMENTS_MARKER), 'SEG'),
    cutDeclaration(source, 'CALIBRES'),
    cutDeclaration(source, 'ROUPA_COR'),
    cutDeclaration(source, 'CIVIL_COR'),
    cutBetween(source, 'const catTable = [];', '\n'),
    cutDeclaration(fromMarker(source, CORE_MARKER), 'clamp'),
    cutFunction(fromMarker(source, CORE_MARKER), 'pick'),
  ].join('\n')

/** The zombie table of the game with a small capacity (the golden spawns one at a time), cut from the horde section. */
const zombieTableCode = (source: string, capacity: number): string => {
  const horde = fromMarker(source, HORDE_MARKER)
  return [`const ZMAX = ${capacity};`, cutDeclaration(horde, 'Z'), cutDeclaration(horde, 'FIELDS')].join('\n')
}

/**
 * The variant ids per type the way the ZVAR block hands them out: the number of variants per type is the block's own `nv` expression,
 * the block itself needs WebGL to bake the bodies.
 */
const variantCode = (source: string): string => {
  const expression = /const nv = (c === CAT\.lento \? 4 : [^;]+);/.exec(fromMarker(source, 'const ZVAR = [], ZVAR_OF'))?.[1]
  if (!expression) throw new Error('characters-catalog: the variant count rule was not found in the game')
  return `const ZVAR_OF = CATS.map(() => []); { let next = 0; CATS.forEach((C, c) => { const nv = ${expression}; for (let v = 0; v < nv; v++) ZVAR_OF[c].push(next++) }) }`
}

export type GameContext = Readonly<Record<string, unknown>>

const codeCache = new Map<string, string>()

/** The cut code depends only on what is asked for, so each distinct slice is cut once per process. */
const buildSliceCode = (options: { readonly functions: readonly string[]; readonly tail?: string; readonly capacity?: number }): string => {
  const key = JSON.stringify([options.functions, options.tail ?? '', options.capacity ?? SMALL_ZOMBIE_CAPACITY])
  const cached = codeCache.get(key)
  if (cached !== undefined) return cached
  const source = readSource(SOURCE_PATHS.game)
  const horde = fromMarker(source, HORDE_MARKER)
  const functions = options.functions.map((name) => cutFunction(horde, name))
  const code = [rulesCode(source), zombieTableCode(source, options.capacity ?? SMALL_ZOMBIE_CAPACITY), variantCode(source), ...functions, options.tail ?? ''].join('\n')
  codeCache.set(key, code)
  return code
}

/**
 * Runs a slice of the game in an empty context. `scope` supplies what the slice reads from the rest of the game (the RNG, the effects as
 * recording stubs); `extra` is more game code (named functions) to cut in, and `exports` the names to hand back. `capacity` is the zombie table's
 * size (8 by default: the goldens spawn one at a time).
 */
export const evaluateGameSlice = <TValue extends GameContext>(options: { readonly functions: readonly string[]; readonly exports: readonly string[]; readonly scope: Record<string, unknown>; readonly tail?: string; readonly capacity?: number }): TValue =>
  evaluateSlice<TValue>(buildSliceCode(options), options.exports, options.scope)
