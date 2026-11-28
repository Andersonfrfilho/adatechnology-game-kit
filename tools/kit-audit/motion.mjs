// @ts-check
// Rules size-blind-motion and own-integrator (docs/analise-arquitetura-e-validacao-2026-11.md, 10.1, 10.2 and 10.4 items 2 and 7; specs/regras/12-objetos-quebrados.md).
// The defect class: a motion rule written for one size and applied to any size (a fixed rad/s on a 4 m board), and a hand-written integrator beside the rigid-body engine.
// Both rules read packages/*/src (.ts .js .mjs; not tests, dist or the engine packages) and share one pattern: a counted list that only shrinks.
//   size-blind-motion: a write to an angular velocity (`.ang.x +=`, `angularVelocity[i] =`, `angularVelocity: [`, `SetAngularVelocity(`), a `slerp` of a pose, or a constant
//     named *SPIN / *NUDGE / *TOPPLE / *TIP_TURN / *SWAY / *AIM_GAIN set to a number, whose right-hand side does not name a half-measure, reach, radius or inertia.
//     An entry of size-blind-motion.json is `file` + `match` (the start of the line); a line that is in no entry fails; `count` (default 1) is how many equal lines the entry covers.
//   own-integrator: a line that advances a position, an angle or a speed by a velocity, spin, acceleration or gravity times a time step, outside game-physics and game-physics-jolt.
//     An entry of own-integrator.json is `file` + `anchor` (the enclosing function) and `lines`, how many such lines it holds; a new anchor, or more lines than recorded, fails.
// Entries that no longer match are reported as stale: take them out. An entry is never added to make the check pass: fix the code, or the owner decides (CLAUDE.md, regra 12).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')

const SKIP_DIRS = ['node_modules', 'dist', 'tests', 'assets', 'generated']
/** The rigid-body engine itself (the one place that may integrate) and shader sources (GLSL in a string). */
const ENGINE = /^packages\/(game-physics|game-physics-jolt)\/|\/src\/shaders\//
const MATCH_LENGTH = 100

const ANGULAR_WRITE =
  /(\.ang\.[xyz]\s*[-+*/]?=(?!=)|\.ang\.(?:set|add|multiplyScalar|copy|addScaledVector)\(|\bangularVelocity(?:\[[^\]]+\])?\s*[-+*/]?=(?!=)|\bangularVelocity\s*:\s*\[|\bangularVelocity\s*:\s*(?=\w)|\.?SetAngularVelocity\(|\bsetAngularVelocity\()/
const POSE_SLERP = /\.slerp(?:Quaternions)?\(/
const SPIN_CONSTANT = /^\s*(?:export\s+)?const\s+[A-Z0-9_]*(?:SPIN|NUDGE|TOPPLE|TIP_TURN|SWAY|AIM_GAIN)\s*=\s*-?[\d.]+/
/** What a right-hand side must cite to count as scaled by the body: a half-measure, a reach, a radius, an inertia. */
const SIZE_AWARE = /reach|inertia|extent|radius|lever|\bhalf|Half|\bhx\b|\bhy\b|\bhz\b|\bsize\b|momentArm/i

const TIME_STEP = String.raw`(?:dt|deltaTime|delta|dtSeconds|step\.dt|h)`
const MOTION_OPERAND = String.raw`(?:(?<![A-Za-z])vel\w*|\bv[xyz]\b|\.v[xyz]\b|[sS]pin\w*|\bw\b|[aA]ccel\w*|[gG]rav\w*|GRAV\w*|\bg\b|9\.8|\brise\b|\bfall\b|angularVelocity)`
const INTEGRATION_STEP = new RegExp(String.raw`[-+]=[^;]*\b${MOTION_OPERAND}[^;]*\*\s*\b${TIME_STEP}\b|[-+]=[^;]*\b${TIME_STEP}\b\s*\*[^;]*${MOTION_OPERAND}|addScaledVector\([^)]*(?:vel|velocity)[^)]*,\s*${TIME_STEP}\b`)

/** @typedef {{ file: string, line: number, anchor: string, match: string, code: string }} MotionHit */
/** @typedef {{ file: string, anchor: string, match: string, count?: number, risk: string, reference: string, note?: string }} SizeBlindEntry */
/** @typedef {{ file: string, anchor: string, lines: number, risk: string, reference: string, note?: string }} IntegratorEntry */

/** The text with block comments blanked (offsets and newlines kept) and line comments cut. @param {string} text */
const withoutComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' ')).replace(/(?<![:'"`])\/\/.*$/gm, '')

const NOT_A_DECLARATION = /^(if|for|while|switch|catch|return|else|function)$/
const indentOf = (/** @type {string} */ line) => line.length - line.trimStart().length

/** The function (or arrow constant) that holds a line: the nearest earlier declaration with a smaller indent; `<module>` at the top. @param {string[]} lines @param {number} index */
export function anchorOf(lines, index) {
  const indent = indentOf(lines[index] ?? '')
  for (let at = index - 1; at >= 0; at--) {
    const line = lines[at] ?? ''
    if (line.trim() === '' || indentOf(line) >= indent) continue
    const declared = /^\s*(?:export\s+)?(?:async\s+)?function\*?\s+(\w+)|^\s*(?:(?:private|public|protected|static|readonly|async|get|set)\s+)*(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)\s*(?::\s*[^={]+)?\{\s*$|^\s*(?:export\s+)?const\s+(\w+)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*(?::\s*[^=]+)?=>/.exec(line)
    const name = declared?.[1] ?? declared?.[2] ?? declared?.[3]
    if (name && !NOT_A_DECLARATION.test(name)) return name
    if (indentOf(line) === 0) break
  }
  return '<module>'
}

/** Whether an angular-velocity write only copies, zeroes or declares: nothing a size could be missing from. @param {string} rhs */
const isInertWrite = (rhs) => {
  const chain = rhs.replace(/[\w.]+(?:\[[^\]]*\])?\s*=(?!=)/g, '')
  if (chain.replace(/[\s;,)(\[\]0.]/g, '') === '') return true
  if (/^\s*(readonly\s+)?(Vec3|number|\[number)/.test(rhs) || /^\s*\?/.test(rhs)) return true
  const bare = rhs.replace(/\[[^\]]*\]/g, '').replace(/\.\.\./g, '')
  return !/[*+\-/]/.test(bare) && !/(?<![\w.])[1-9]/.test(bare)
}

/** The hits of both rules in one source file. @param {string} path repository-relative, forward slashes @param {string} text @returns {{ sizeBlind: MotionHit[], integrators: MotionHit[] }} */
export function scanMotion(path, text) {
  /** @type {{ sizeBlind: MotionHit[], integrators: MotionHit[] }} */
  const found = { sizeBlind: [], integrators: [] }
  if (ENGINE.test(path)) return found
  const lines = withoutComments(text).split('\n')
  const originals = text.split('\n')
  lines.forEach((line, index) => {
    const hit = () => ({ file: path, line: index + 1, anchor: anchorOf(lines, index), match: line.trim().slice(0, MATCH_LENGTH), code: (originals[index] ?? '').trim().slice(0, 160) })
    const angular = ANGULAR_WRITE.exec(line)
    const slerp = POSE_SLERP.exec(line)
    const constant = SPIN_CONSTANT.exec(line)
    const written = angular ?? slerp ?? constant
    if (written) {
      const rhs = line.slice(written.index + written[0].length)
      const isScaled = SIZE_AWARE.test(rhs) || (constant ? false : SIZE_AWARE.test(line.slice(0, written.index)))
      if (!isScaled && !(angular && isInertWrite(rhs))) found.sizeBlind.push(hit())
    }
    if (INTEGRATION_STEP.test(line)) found.integrators.push(hit())
  })
  return found
}

/** @param {string} dir @param {string[]} [out] @returns {string[]} */
const walkSources = (dir, out = []) => {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.includes(name)) continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walkSources(path, out)
    else if (/\.(ts|js|mjs)$/.test(name) && !/\.d\.ts$/.test(name)) out.push(path)
  }
  return out
}

/** Every hit of the repository, per rule. @returns {{ sizeBlind: MotionHit[], integrators: MotionHit[] }} */
export function motionHits() {
  const all = { sizeBlind: /** @type {MotionHit[]} */ ([]), integrators: /** @type {MotionHit[]} */ ([]) }
  for (const name of readdirSync(join(root, 'packages')).sort()) {
    for (const file of walkSources(join(root, 'packages', name, 'src')).sort()) {
      const found = scanMotion(relative(root, file).split('\\').join('/'), readFileSync(file, 'utf8'))
      all.sizeBlind.push(...found.sizeBlind)
      all.integrators.push(...found.integrators)
    }
  }
  return all
}

/** @param {string} name */
const readList = (name) => JSON.parse(readFileSync(join(here, name), 'utf8')).pending

/**
 * Compares the hits with the recorded entries: `open` is what no entry covers, `known` what one does, `stale` the entries that cover nothing (or less than they say).
 * @param {MotionHit[]} hits @param {SizeBlindEntry[]} [override] list for tests
 */
export function checkSizeBlind(hits, override) {
  /** @type {SizeBlindEntry[]} */
  const entries = override ?? readList('size-blind-motion.json')
  const used = new Map(entries.map((entry) => [entry, 0]))
  /** @type {MotionHit[]} */
  const open = []
  /** @type {MotionHit[]} */
  const known = []
  for (const hit of hits) {
    const entry = entries.find((candidate) => candidate.file === hit.file && hit.match.startsWith(candidate.match) && (used.get(candidate) ?? 0) < (candidate.count ?? 1))
    if (!entry) open.push(hit)
    else {
      used.set(entry, (used.get(entry) ?? 0) + 1)
      known.push(hit)
    }
  }
  const stale = entries.filter((entry) => (used.get(entry) ?? 0) < (entry.count ?? 1))
  return { open, known, stale, size: entries.reduce((sum, entry) => sum + (entry.count ?? 1), 0) }
}

/**
 * @param {MotionHit[]} hits @param {IntegratorEntry[]} [override] list for tests
 */
export function checkOwnIntegrator(hits, override) {
  /** @type {IntegratorEntry[]} */
  const entries = override ?? readList('own-integrator.json')
  /** @type {Map<string, MotionHit[]>} */
  const byAnchor = new Map()
  for (const hit of hits) byAnchor.set(`${hit.file}::${hit.anchor}`, [...(byAnchor.get(`${hit.file}::${hit.anchor}`) ?? []), hit])
  /** @type {MotionHit[]} */
  const open = []
  /** @type {MotionHit[]} */
  const known = []
  for (const [key, group] of byAnchor) {
    const entry = entries.find((candidate) => `${candidate.file}::${candidate.anchor}` === key)
    const allowed = entry?.lines ?? 0
    known.push(...group.slice(0, allowed))
    open.push(...group.slice(allowed))
  }
  const stale = entries.filter((entry) => (byAnchor.get(`${entry.file}::${entry.anchor}`)?.length ?? 0) < entry.lines)
  return { open, known, stale, size: entries.length }
}

export const SIZE_BLIND_MESSAGE = 'angular velocity, pose slerp or spin constant that does not cite a half-measure, reach or inertia (regra 12: write it by the speed of the tip, in m/s, or by energy, never a fixed rad/s)'
export const OWN_INTEGRATOR_MESSAGE = 'a motion integrator outside game-physics (regra 12: hand the body to the engine with mass and material; a new integrator is the owner\'s decision)'
