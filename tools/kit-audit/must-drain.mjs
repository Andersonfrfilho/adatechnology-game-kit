// @ts-check
// Rule must-drain (CLAUDE.md §15, spec 017 trava 2): a queue registered with `mustDrain: true` drains whole, outside the frame deadline, so each one adds to the
// worst frame by construction. "A new queue does not enter that class without the owner's decision": here that is a list, must-drain-allowed.json. The lock that
// cannot be bypassed by a spelling is at run time (`MUST_DRAIN_QUEUE_IDS` in game-contracts, checked by `budget.register`); this is the early warning in the audit.
// Flagged, in packages/*/src, examples/* and apps/* (.ts .tsx .js .mjs; not tests): any `mustDrain` key whose value is not the literal `false`: `true` for a queue that is not
// an entry of the list (the queue is read from the object literal around it: `DEFERRED_QUEUE_ID.X` or its string, exact), and any value the rule cannot read (a variable, a
// ternary, a shorthand, a quoted or computed key, a value on the next line). A type (`mustDrain?: boolean`) and the plumbing of game-runtime (the mechanism) are not registrations.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')

const KEY = /(?:(?<![\w$.])['"]?mustDrain['"]?\s*\??\s*:|\[\s*['"]mustDrain['"]\s*\]\s*\??\s*:|\.mustDrain\s*=(?!=))\s*/g
const SHORTHAND = /[{,]\s*mustDrain\s*(?=[,}])/g
/** The mechanism itself: game-runtime reads the option and keeps it in its entries. */
const EXEMPT = /^packages\/game-runtime\/src\//
const SKIP_DIRS = ['node_modules', 'dist', 'tests', 'assets', 'generated']

/** @typedef {{ queue: string, constant: string, package: string, reason: string }} AllowedQueue */
/** @typedef {{ file: string, line: number, code: string, reason: string }} MustDrainHit */

/** The text with its comments blanked (newlines and offsets kept), so a block comment of many lines or a quoted name never matches. @param {string} text */
const withoutComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' ')).replace(/(?<!:)\/\/.*$/gm, (tail) => ' '.repeat(tail.length))

/** The object literal around an offset (the braces that hold it), or the line when there are none. @param {string} text @param {number} at */
const literalAround = (text, at) => {
  let start = at
  for (let depth = 0; start > 0; start--) {
    const char = text[start - 1]
    if (char === '}') depth++
    if (char === '{' && depth-- === 0) break
  }
  let end = at
  for (let depth = 0; end < text.length; end++) {
    const char = text[end]
    if (char === '{') depth++
    if (char === '}' && depth-- === 0) break
  }
  return text.slice(start, end)
}

/** Whether the literal names an allowed queue of this package, exactly. @param {string} literal @param {string} owner @param {AllowedQueue[]} allowed */
const namesAllowedQueue = (literal, owner, allowed) => allowed.some((entry) => entry.package === owner && (new RegExp(`\\bDEFERRED_QUEUE_ID\\.${entry.constant}\\b`).test(literal) || new RegExp(`(['"\`])${entry.queue.replace(/\./g, '\\.')}\\1`).test(literal)))

/** The owner of a file: `game-floorplan-three` for a package, `examples/x` or `apps/x` otherwise. @param {string} path */
const ownerOfPath = (path) => {
  const parts = path.split('/')
  return parts[0] === 'packages' ? (parts[1] ?? '') : `${parts[0]}/${parts[1]}`
}

/**
 * Violations of the rule in one source file.
 * @param {string} path repository-relative, forward slashes
 * @param {string} text
 * @param {AllowedQueue[]} allowed
 * @returns {MustDrainHit[]}
 */
export function scanMustDrain(path, text, allowed) {
  if (EXEMPT.test(path)) return []
  const code = withoutComments(text)
  const owner = ownerOfPath(path)
  const lineOf = (/** @type {number} */ at) => code.slice(0, at).split('\n').length
  const hit = (/** @type {number} */ at, /** @type {string} */ reason) => ({ file: path, line: lineOf(at), code: (text.split('\n')[lineOf(at) - 1] ?? '').trim().slice(0, 160), reason })
  /** @type {MustDrainHit[]} */
  const hits = []
  for (const match of code.matchAll(KEY)) {
    const rest = code.slice(match.index + match[0].length)
    const value = (rest.split(/[,}\n;)]/)[0] ?? '').trim()
    if (value === 'false' || value === 'boolean') continue
    if (value !== 'true') hits.push(hit(match.index, `mustDrain has a value the audit cannot read (${value || 'empty'}): write the literal true for an allowed queue, or false`))
    else if (!namesAllowedQueue(literalAround(code, match.index), owner, allowed)) hits.push(hit(match.index, 'mustDrain: true for a queue that is not in must-drain-allowed.json (or not named in the same object)'))
  }
  // the option that swaps the runtime's list: only game-runtime (exempt above) and its tests may spell it
  for (const match of code.matchAll(/\bmustDrainIds\b/g)) hits.push(hit(match.index, 'mustDrainIds replaces the runtime list of must-drain queues: only game-runtime and its tests may use it'))
  for (const match of code.matchAll(SHORTHAND)) hits.push(hit(match.index, 'mustDrain as a shorthand property: its value cannot be read'))
  return hits.sort((left, right) => left.line - right.line)
}

/** The message of a violation: what is wrong and which rule says so. @param {MustDrainHit} found */
export const mustDrainMessage = (found) => `${found.file}:${found.line} ${found.reason} (CLAUDE.md §15: a new queue does not enter the mustDrain class without the owner's decision)`

/** @param {string} dir @param {string[]} [out] @returns {string[]} */
const walkSources = (dir, out = []) => {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.includes(name)) continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walkSources(path, out)
    else if (/\.(ts|tsx|js|mjs)$/.test(name) && !/\.d\.ts$/.test(name)) out.push(path)
  }
  return out
}

/** The source files the rule reads: packages/*\/src, examples/* and apps/*. @returns {string[]} */
const sourceFiles = () => {
  const roots = ['packages', 'examples', 'apps'].flatMap((group) => (existsSync(join(root, group)) ? readdirSync(join(root, group)).map((name) => join(root, group, name, group === 'packages' ? 'src' : '')) : []))
  return roots.flatMap((dir) => walkSources(dir))
}

/** Every violation of the repository. @param {AllowedQueue[]} [override] allowed list for tests @returns {MustDrainHit[]} */
export function mustDrainViolations(override) {
  /** @type {AllowedQueue[]} */
  const allowed = override ?? JSON.parse(readFileSync(join(here, 'must-drain-allowed.json'), 'utf8')).allowed
  return sourceFiles().flatMap((file) => scanMustDrain(relative(root, file).split('\\').join('/'), readFileSync(file, 'utf8'), allowed))
}
