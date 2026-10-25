import { Script, runInNewContext } from 'node:vm'

const EVALUATION_TIMEOUT_MS = 5000
const OPENERS: Readonly<Record<string, string>> = { '[': ']', '{': '}', '(': ')' }
const CLOSERS = new Set(Object.values(OPENERS))
const QUOTES = new Set(["'", '"'])
const LINE_BREAKS = new Set(['\n', '\r', '\u2028', '\u2029'])
const REGEX_PRECEDERS = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^'])

const fail = (message: string): never => {
  throw new Error(`cut-source: ${message}`)
}

const previousSignificant = (source: string, index: number): string => {
  for (let cursor = index - 1; cursor >= 0; cursor--) {
    const character = source.charAt(cursor)
    if (character !== ' ' && character !== '\t' && character !== '\n' && character !== '\r') return character
  }
  return ''
}

const skipQuoted = (source: string, start: number): number => {
  const quote = source.charAt(start)
  for (let index = start + 1; index < source.length; index++) {
    const character = source.charAt(index)
    if (character === '\\') index += 1
    else if (character === quote) return index
  }
  return fail('unterminated string')
}

const skipTemplate = (source: string, start: number): number => {
  for (let index = start + 1; index < source.length; index++) {
    const character = source.charAt(index)
    if (character === '\\') index += 1
    else if (character === '`') return index
    else if (character === '$' && source.charAt(index + 1) === '{') index = findGroupEnd(source, index + 1) - 1
  }
  return fail('unterminated template literal')
}

const skipRegex = (source: string, start: number): number => {
  let inClass = false
  for (let index = start + 1; index < source.length; index++) {
    const character = source.charAt(index)
    if (character === '\\') index += 1
    else if (character === '[') inClass = true
    else if (character === ']') inClass = false
    else if (character === '/' && !inClass) return index
    else if (character === '\n') return fail('unterminated regular expression')
  }
  return fail('unterminated regular expression')
}

/** Index just past the bracket group that opens at `start`, skipping brackets inside strings, templates, regular expressions and comments. */
export const findGroupEnd = (source: string, start: number): number => {
  let depth = 0
  for (let index = start; index < source.length; index++) {
    const character = source.charAt(index)
    if (QUOTES.has(character)) index = skipQuoted(source, index)
    else if (character === '`') index = skipTemplate(source, index)
    else if (character === '/' && source.charAt(index + 1) === '/') {
      index = source.indexOf('\n', index)
      if (index < 0) break
    } else if (character === '/' && source.charAt(index + 1) === '*') index = source.indexOf('*/', index) + 1
    else if (character === '/' && REGEX_PRECEDERS.has(previousSignificant(source, index))) index = skipRegex(source, index)
    else if (character in OPENERS) depth += 1
    else if (CLOSERS.has(character)) {
      depth -= 1
      if (depth === 0) return index + 1
    }
  }
  return fail('unbalanced brackets')
}

/** Index of the first `;` (or end of source) after `start` that sits outside every bracket group. */
const findStatementEnd = (source: string, start: number): number => {
  for (let index = start; index < source.length; index++) {
    const character = source.charAt(index)
    if (character === ';') return index + 1
    if (character in OPENERS) index = findGroupEnd(source, index) - 1
    else if (QUOTES.has(character)) index = skipQuoted(source, index)
    else if (character === '`') index = skipTemplate(source, index)
    else if (character === '/' && source.charAt(index + 1) === '/') index = source.indexOf('\n', index)
    else if (character === '/' && source.charAt(index + 1) === '*') index = source.indexOf('*/', index) + 1
  }
  return source.length
}

const escapeForPattern = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The first match of `pattern` (sticky, written to start at a line) among the lines that mention `name`. Same result as a multiline `^...` scan of the
 * whole source, without scanning the megabytes of text that never mention the name.
 */
const matchAtLineStart = (source: string, name: string, pattern: RegExp): RegExpExecArray | null => {
  for (let from = source.indexOf(name); from >= 0; from = source.indexOf(name, nextLineStart(source, from))) {
    let lineStart = from
    while (lineStart > 0 && !LINE_BREAKS.has(source.charAt(lineStart - 1))) lineStart -= 1
    pattern.lastIndex = lineStart
    const match = pattern.exec(source)
    if (match) return match
  }
  return null
}

const nextLineStart = (source: string, from: number): number => {
  const lineEnd = source.indexOf('\n', from)
  return lineEnd < 0 ? source.length : lineEnd + 1
}

const declarationStart = (source: string, name: string): { readonly index: number; readonly valueStart: number } => {
  const match = matchAtLineStart(source, name, new RegExp(`[ \\t]*(?:const|let|var) ${escapeForPattern(name)}\\s*=\\s*`, 'y'))
  if (!match) return fail(`"${name}" not found in the source`)
  return { index: match.index, valueStart: match.index + match[0].length }
}

/** The text of `const <name> = <literal>;` (the literal only), found at the start of a line. */
export const cutLiteral = (source: string, name: string): string => {
  const { valueStart } = declarationStart(source, name)
  return source.slice(valueStart, findGroupEnd(source, valueStart))
}

/** The whole declaration statement `const <name> = ...;`, for a value that is not one bracket group (an IIFE, an arrow function, a template). */
export const cutDeclaration = (source: string, name: string): string => {
  const { index, valueStart } = declarationStart(source, name)
  return source.slice(index, findStatementEnd(source, valueStart)).trimStart()
}

/** The text of `function <name>(...) {...}` (also `async function` and `class`), found at the start of a line. */
export const cutFunction = (source: string, name: string): string => {
  const match = matchAtLineStart(source, name, new RegExp(`[ \\t]*(?:async )?(?:function\\*? |class )${escapeForPattern(name)}\\b`, 'y'))
  if (!match) return fail(`function "${name}" not found in the source`)
  const bodyStart = source.indexOf('{', source.indexOf(')', match.index))
  return source.slice(match.index, findGroupEnd(source, bodyStart)).trimStart()
}

/** Text from the first occurrence of `startMarker` up to (not including) the next `endMarker`; both must exist. */
export const cutBetween = (source: string, startMarker: string, endMarker: string): string => {
  const start = source.indexOf(startMarker)
  if (start < 0) return fail(`start marker "${startMarker}" not found`)
  const end = source.indexOf(endMarker, start + startMarker.length)
  if (end < 0) return fail(`end marker "${endMarker}" not found after "${startMarker}"`)
  return source.slice(start, end)
}

/** Lines `from..to` (1-based, inclusive) of the source. Anchors drift with the source: prefer a named cut and keep this for one-off ranges. */
export const cutLines = (source: string, from: number, to: number): string => source.split('\n').slice(from - 1, to).join('\n')

/** Evaluates a literal cut from a team page in an empty context; `scope` supplies the few names the literal reads. */
export const evaluateLiteral = <TValue>(literal: string, scope: Record<string, unknown> = {}): TValue =>
  runInNewContext(`(${literal})`, scope, { timeout: EVALUATION_TIMEOUT_MS }) as TValue

export const extractLiteral = <TValue>(source: string, name: string, scope: Record<string, unknown> = {}): TValue =>
  evaluateLiteral<TValue>(cutLiteral(source, name), scope)

const compiledSlices = new Map<string, Script>()

/**
 * Builtins a slice reads as globals. A sandboxed context answers every global lookup through an interceptor, which is slow in a hot loop, so the
 * slice reads them (and the scope) as locals instead; the values are the context's own, so nothing leaks in from the host.
 */
const BUILTIN_GLOBALS = ['Math', 'Object', 'Array', 'JSON', 'Number', 'String', 'Boolean', 'Symbol', 'Set', 'Map', 'WeakMap', 'Date', 'Error', 'RegExp', 'Float32Array', 'Float64Array', 'Int8Array', 'Int16Array', 'Int32Array', 'Uint8Array', 'Uint16Array', 'Uint32Array', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'Infinity', 'NaN']

/** A slice compiles once per process; every run still gets a context of its own, so no state is shared between runs. */
const compiledSlice = (code: string, exports: readonly string[], scopeNames: readonly string[]): Script => {
  const wrapped = `(() => {\nlet { ${scopeNames.join(', ')} } = __sliceScope;\nconst { ${BUILTIN_GLOBALS.filter((name) => !scopeNames.includes(name)).join(', ')} } = globalThis;\nreturn (() => {\n${code}\nreturn { ${exports.join(', ')} }\n})()\n})()`
  const cached = compiledSlices.get(wrapped)
  if (cached) return cached
  const script = new Script(wrapped)
  compiledSlices.set(wrapped, script)
  return script
}

/**
 * Runs a slice of team code in an empty context (with `scope` as its globals) and returns the names it ends up defining. Names declared with
 * `const`/`let` stay inside the slice: list them in `exports` and they come back.
 */
export const evaluateSlice = <TValue extends Record<string, unknown>>(code: string, exports: readonly string[], scope: Record<string, unknown> = {}): TValue =>
  compiledSlice(code, exports, Object.keys(scope)).runInNewContext({ __sliceScope: scope }, { timeout: EVALUATION_TIMEOUT_MS }) as TValue
