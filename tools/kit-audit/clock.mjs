// Rule own-frame-clock (CLAUDE.md §15, spec 010 T1.7): outside game-runtime, nothing times deferred work with its own clock.
// Flags (a) a constant named *_BUDGET_MS / *_SLICE_MS and (b) performance.now() / Date.now() compared with (or added to) a deadline or budget.
// Exempt by class, not by list: game-runtime and game-workers (§14), bench code, the physics WorkBudget (ms become units, no clock),
// `drainDetached` of game-contracts (and a constant only ever its budget), timers and waits (a rate, an expiry, a worker wait), and measurement (a subtraction nobody compares).
// Known hits that other tasks of spec 010 still remove live in clock-pending.json; C3 wants that list empty at the end of phase 1.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { wordsOf } from './audit.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')

const CLOCK_CALL = /\b(?:performance|Date)\.now\(\)/g
const COMPARISON = /^(>=|<=|>|<)(?![>=])/
const CONSTANT = /\b(?:const|let|var|static|readonly)\s+((?:[A-Z0-9]+_)*(?:BUDGET|SLICE)_MS)\b/

const DEADLINE_WORDS = ['deadline', 'until', 'cutoff', 'limit', 'budget', 'slice']
const TIMER_WORDS = ['wait', 'timeout', 'interval', 'cooldown', 'every', 'after', 'delay', 'hz', 'rate', 'throttle', 'debounce', 'ttl', 'expire', 'tap']
const OWN_ROOTS = ['this', 'options', 'opts', 'setup', 'config']

/** Directories (and the one file) where timing is the job: the owner of the frame, the workers (§14), benches, the WorkBudget (units). */
const EXEMPT_PATHS = [/^packages\/game-runtime\//, /^packages\/game-workers\//, /\/bench\//, /^packages\/game-physics\/src\/work-budget\.ts$/]

/** Line range (1-based) of `drainDetached` in game-contracts/src/frame.ts: the one sanctioned clock of deferred work outside game-runtime. */
const drainDetachedRange = (/** @type {string[]} */ lines) => {
  const start = lines.findIndex((line) => /^export function drainDetached\b/.test(line))
  if (start < 0) return undefined
  const end = lines.findIndex((line, index) => index >= start && line === '}')
  return { from: start + 1, to: end < 0 ? lines.length : end + 1 }
}

/** Code of a line without its comments (a `//` tail, `/* ... *\/` pieces, a comment-only line), so a name quoted in a doc comment is no use of it. */
const codeOf = (/** @type {string} */ line) => {
  const trimmed = line.trim()
  if (/^(\/\/|\/\*|\*)/.test(trimmed)) return ''
  return line.replace(/\/\*.*?\*\//g, '').replace(/\/\/.*$/, '')
}

/**
 * A `*_BUDGET_MS` / `*_SLICE_MS` constant is exempt when it is only ever handed to `drainDetached`: as (part of) the arguments of the call, or as a
 * `budgetMs` option or default (`budgetMs: X`, `budgetMs = X`), the contract's name for the budget that a detached drain times. Judged by the uses in
 * the file, not by the name: one other use (a `performance.now() + X` deadline, a comparison) keeps it flagged, and a constant never used is flagged too.
 */
const isOnlyDetachedBudget = (/** @type {string} */ name, /** @type {number} */ declaredAt, /** @type {string[]} */ lines) => {
  const word = new RegExp(`\\b${name}\\b`)
  let uses = 0
  for (let index = 0; index < lines.length; index++) {
    if (index === declaredAt) continue
    const code = codeOf(lines[index] ?? '')
    if (!word.test(code)) continue
    uses++
    const call = code.indexOf('drainDetached(')
    const inCall = call >= 0 && word.test(code.slice(call))
    const asOption = new RegExp(`\\bbudgetMs\\s*[:=]\\s*${name}\\b`).test(code)
    if (!inCall && !asOption) return false
  }
  return uses > 0
}

/** The operand a clock call is compared with, or the budget it is added to, on this line; undefined when it is only measured. */
const operandOf = (/** @type {string} */ line, /** @type {number} */ at, /** @type {number} */ length) => {
  const after = line.slice(at + length)
  const subtraction = after.match(/^\s*-\s*[\w.$]+\s*/)
  const tail = after.slice(subtraction ? subtraction[0].length : 0).trimStart()
  const op = tail.match(COMPARISON)
  if (op) return tail.slice(op[0].length).split(/&&|\|\||[;?,)]/)[0]
  const plus = after.match(/^\s*\+\s*(.*)$/)
  if (plus && /budget|slice/i.test(plus[1])) return plus[1]
  const before = line.slice(0, at).match(/([\w.$]+)\s*(?:>=|<=|>|<)\s*\(?\s*$/)
  return before ? before[1] : undefined
}

/** Why a deadline-looking operand is not deferred work: a rate, an expiry or a wait (the timer classes), or undefined when it is a deadline. */
export const timerClassOf = (/** @type {string} */ operand) => {
  const words = wordsOf(operand)
  if (TIMER_WORDS.some((word) => words.has(word))) return 'timer'
  const member = operand.trim().match(/^\(?!?\s*([A-Za-z_$][\w$]*)((?:\.[\w$]+)+)/)
  if (member && !OWN_ROOTS.includes(member[1])) return 'stored-expiry'
  return undefined
}

/**
 * Hits of the rule in one source file.
 * @param {string} path repository-relative, forward slashes
 * @param {string} text
 * @returns {{ file: string, line: number, kind: 'constant' | 'deadline', code: string }[]}
 */
export function scanOwnFrameClock(path, text) {
  if (EXEMPT_PATHS.some((pattern) => pattern.test(path))) return []
  const lines = text.split('\n')
  const detached = path === 'packages/game-contracts/src/frame.ts' ? drainDetachedRange(lines) : undefined
  /** @type {{ file: string, line: number, kind: 'constant' | 'deadline', code: string }[]} */
  const hits = []
  lines.forEach((line, index) => {
    const number = index + 1
    if (detached && number >= detached.from && number <= detached.to) return
    const code = line.trim().slice(0, 160)
    const constant = line.match(CONSTANT)
    if (constant && !isOnlyDetachedBudget(constant[1] ?? '', index, lines)) hits.push({ file: path, line: number, kind: 'constant', code })
    for (const call of line.matchAll(CLOCK_CALL)) {
      const operand = operandOf(line, call.index, call[0].length)
      if (operand === undefined) continue
      const words = wordsOf(operand)
      if (!DEADLINE_WORDS.some((word) => words.has(word))) continue
      if (timerClassOf(operand)) continue
      hits.push({ file: path, line: number, kind: 'deadline', code })
      break
    }
  })
  return hits
}

/** @param {string} dir @param {string[]} out */
export const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', 'tests', 'assets', 'generated'].includes(name)) continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.(ts|js|mjs)$/.test(name) && !/\.d\.ts$/.test(name)) out.push(path)
  }
  return out
}

/**
 * Every hit of the repository, split into the known pending ones (with the task that removes them) and the open ones; `stale` are pending
 * entries that no longer match any line (fixed: take them out of clock-pending.json).
 * @param {{ pending?: { file: string, match: string, task: string }[] }} [override] pending list for tests
 */
export function ownFrameClock(override) {
  /** @type {{ file: string, match: string, task: string }[]} */
  const pendingList = override?.pending ?? JSON.parse(readFileSync(join(here, 'clock-pending.json'), 'utf8')).pending
  /** @type {ReturnType<typeof scanOwnFrameClock>} */
  const hits = []
  for (const group of ['packages', 'examples']) {
    for (const name of existsSync(join(root, group)) ? readdirSync(join(root, group)) : []) {
      for (const file of walk(join(root, group, name, 'src'))) {
        const path = relative(root, file).split('\\').join('/')
        hits.push(...scanOwnFrameClock(path, readFileSync(file, 'utf8')))
      }
    }
  }
  const used = new Set()
  const classified = hits.map((hit) => {
    const entry = pendingList.find((item) => item.file === hit.file && hit.code.includes(item.match))
    if (entry) used.add(entry)
    return { ...hit, ...(entry ? { pending: entry.task } : {}) }
  })
  return { hits: classified, open: classified.filter((hit) => !hit.pending), pending: classified.filter((hit) => hit.pending), stale: pendingList.filter((entry) => !used.has(entry)) }
}
