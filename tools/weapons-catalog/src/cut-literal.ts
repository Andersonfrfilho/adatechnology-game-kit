import { runInNewContext } from 'node:vm'

const EVALUATION_TIMEOUT_MS = 2000
const OPENERS: Readonly<Record<string, string>> = { '[': ']', '{': '}', '(': ')' }
const CLOSERS = new Set(Object.values(OPENERS))
const QUOTES = new Set(["'", '"', '`'])

/** Index just past the bracket group that opens at `start`, skipping brackets inside strings and comments. */
const findGroupEnd = (source: string, start: number): number => {
  let depth = 0
  for (let index = start; index < source.length; index++) {
    const character = source.charAt(index)
    if (QUOTES.has(character)) {
      index = skipString(source, index)
      continue
    }
    if (character === '/' && source.charAt(index + 1) === '/') {
      index = source.indexOf('\n', index)
      if (index < 0) break
      continue
    }
    if (character === '/' && source.charAt(index + 1) === '*') {
      index = source.indexOf('*/', index) + 1
      continue
    }
    if (character in OPENERS) depth += 1
    else if (CLOSERS.has(character)) {
      depth -= 1
      if (depth === 0) return index + 1
    }
  }
  throw new Error('weapons-catalog: unbalanced brackets')
}

const skipString = (source: string, start: number): number => {
  const quote = source.charAt(start)
  for (let index = start + 1; index < source.length; index++) {
    const character = source.charAt(index)
    if (character === '\\') index += 1
    else if (character === quote) return index
  }
  throw new Error('weapons-catalog: unterminated string')
}

/** The text of `const <name> = <literal>;` (the literal only), found at the start of a line. */
export const cutLiteral = (source: string, name: string): string => {
  const match = new RegExp(`^(?:const|let|var) ${name}\\s*=\\s*`, 'm').exec(source)
  if (!match) throw new Error(`weapons-catalog: "${name}" not found in the source`)
  const start = match.index + match[0].length
  return source.slice(start, findGroupEnd(source, start))
}

/** Evaluates a literal cut from a team page in an empty context; `scope` supplies the few names the literal reads. */
export const evaluateLiteral = <TValue>(literal: string, scope: Record<string, unknown> = {}): TValue =>
  runInNewContext(`(${literal})`, scope, { timeout: EVALUATION_TIMEOUT_MS }) as TValue

export const extractLiteral = <TValue>(source: string, name: string, scope: Record<string, unknown> = {}): TValue =>
  evaluateLiteral<TValue>(cutLiteral(source, name), scope)
