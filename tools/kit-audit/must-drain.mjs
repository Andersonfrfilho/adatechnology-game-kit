// @ts-check
// Rule must-drain (CLAUDE.md §15, spec 017 trava 2): a queue registered with `mustDrain: true` drains whole, outside the frame deadline, so each one adds to the
// worst frame by construction. "A new queue does not enter that class without the owner's decision": here that is a list, must-drain-allowed.json. Any
// `mustDrain: true` in packages/*/src that is not that queue, in that package, is a violation. The queue is read from the same line (`DEFERRED_QUEUE_ID.X` or its string);
// a line that does not say which queue it is also a violation: the rule cannot tell it is allowed.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { walk } from './clock.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')

const MUST_DRAIN = /\bmustDrain\s*:\s*true\b/

/** @typedef {{ queue: string, constant: string, package: string, reason: string }} AllowedQueue */

/** Code of a line without its comments. @param {string} line */
const codeOf = (line) => (/^\s*(\/\/|\/\*|\*)/.test(line) ? '' : line.replace(/\/\*.*?\*\//g, '').replace(/\/\/.*$/, ''))

/**
 * Violations of the rule in one source file.
 * @param {string} path repository-relative, forward slashes
 * @param {string} text
 * @param {AllowedQueue[]} allowed
 * @returns {{ file: string, line: number, code: string }[]}
 */
export function scanMustDrain(path, text, allowed) {
  const owner = path.split('/')[1]
  return text.split('\n').flatMap((line, index) => {
    const code = codeOf(line)
    if (!MUST_DRAIN.test(code)) return []
    const isAllowed = allowed.some((entry) => entry.package === owner && (code.includes(`DEFERRED_QUEUE_ID.${entry.constant}`) || code.includes(`'${entry.queue}'`)))
    return isAllowed ? [] : [{ file: path, line: index + 1, code: line.trim().slice(0, 160) }]
  })
}

/** The message of a violation: what is wrong and which rule says so. @param {{ file: string, line: number }} hit */
export const mustDrainMessage = (hit) => `${hit.file}:${hit.line} registers a queue with mustDrain: true outside must-drain-allowed.json (CLAUDE.md §15: a new queue does not enter the mustDrain class without the owner's decision)`

/** Every violation of the repository. @param {AllowedQueue[]} [override] allowed list for tests */
export function mustDrainViolations(override) {
  /** @type {AllowedQueue[]} */
  const allowed = override ?? JSON.parse(readFileSync(join(here, 'must-drain-allowed.json'), 'utf8')).allowed
  return readPackages().flatMap((file) => scanMustDrain(relative(root, file).split('\\').join('/'), readFileSync(file, 'utf8'), allowed))
}

/** The source files of packages/*\/src. @returns {string[]} */
const readPackages = () => {
  const packages = join(root, 'packages')
  return (existsSync(packages) ? readdirSync(packages) : []).flatMap((name) => walk(join(packages, name, 'src')))
}
