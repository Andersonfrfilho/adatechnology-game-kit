#!/usr/bin/env node
// Kit audit: lists the pieces drawn by hand (a three.js primitive or a box/cylinder part of a destructible spec) in a package or example that
// does not own that kind of piece, when the code around it names the piece (a car outside game-vehicles, a wall outside game-floorplan, a table
// outside the household catalogue...). Each finding says which package should give the piece. No dependencies.
//
//   node tools/kit-audit/audit.mjs [--check] [--json] [--package game-weather-three]... [--domain vehicles]...
//
// --check exits 1 when a finding is neither allowed nor a known pending one in allowlist.json. The owners and the words of each domain live in rules.json (see README.md).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')

/** Primitives: a three.js geometry built on the spot, or a box/cylinder/sphere part of a destructible spec. */
const PRIMITIVE = /new\s+[\w$.]+\.(Box|Cylinder|Sphere|Cone|Capsule|Plane|Torus)Geometry\s*\(|kind:\s*['"](box|cylinder|sphere)['"]/

/**
 * Words of a stretch of code: identifiers split on camelCase, `_` and `-`, lower case, without accents.
 * @param {string} text
 */
export function wordsOf(text) {
  return new Set(
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  )
}

/** Owner of a file: `game-weather-three` for a package, `examples/weather-test-area` for an example. */
const ownerOf = (/** @type {string} */ file) => {
  const parts = relative(root, file).split('/')
  return parts[0] === 'packages' ? parts[1] : `${parts[0]}/${parts[1]}`
}

/**
 * @typedef {{ owners: string[], words: string[], use: string }} DomainRule
 * @typedef {{ scan: string[], skip: string[], window: number, domains: Record<string, DomainRule> }} Rules
 * @typedef {{ file: string, domain: string, reason?: string, fix?: string }} ListEntry
 * @typedef {{ file: string, line: number, owner: string, domain: string, words: string[], code: string, use: string, owners: string[], allowed?: string, pending?: string }} Finding
 */

/** @param {string} dir @param {string[]} skip @param {string[]} [out] @returns {string[]} */
const walk = (dir, skip, out = []) => {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (skip.includes(name)) continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, skip, out)
    else if (/\.(ts|js|mjs)$/.test(name) && !/\.d\.ts$/.test(name)) out.push(path)
  }
  return out
}

/** @param {Rules} rules */
const filesOf = (rules) => {
  /** @type {string[]} */
  const files = []
  for (const pattern of rules.scan) {
    const [group, , ...rest] = pattern.split('/')
    for (const name of readdirSync(join(root, group))) walk(join(root, group, name, ...rest), rules.skip, files)
  }
  return files.sort()
}

/**
 * Every finding of the repository (or of `options.packages` / `options.domains`), with `allowed` set from the allowlist.
 * @param {{ packages?: string[], domains?: string[] }} [options]
 * @returns {Finding[]}
 */
export function audit(options = {}) {
  /** @type {Rules} */
  const rules = JSON.parse(readFileSync(join(here, 'rules.json'), 'utf8'))
  /** @type {{ allowed?: ListEntry[], pending?: ListEntry[] }} */
  const lists = JSON.parse(readFileSync(join(here, 'allowlist.json'), 'utf8'))
  const allowlist = lists.allowed ?? []
  const pending = lists.pending ?? []
  /** @type {Finding[]} */
  const findings = []
  for (const file of filesOf(rules)) {
    const owner = ownerOf(file)
    if (options.packages?.length && !options.packages.includes(owner)) continue
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, index) => {
      if (!PRIMITIVE.test(line)) return
      const around = lines.slice(Math.max(0, index - rules.window), index + rules.window + 1).join('\n')
      const words = wordsOf(around)
      for (const [domain, rule] of Object.entries(rules.domains)) {
        if (options.domains?.length && !options.domains.includes(domain)) continue
        if (rule.owners.includes(owner)) continue
        const hits = rule.words.filter((word) => words.has(word))
        if (hits.length === 0) continue
        const path = relative(root, file)
        const allowed = allowlist.find((entry) => entry.file === path && entry.domain === domain)
        const known = pending.find((entry) => entry.file === path && entry.domain === domain)
        findings.push({ file: path, line: index + 1, owner, domain, words: hits, code: line.trim().slice(0, 160), use: rule.use, owners: rule.owners, ...(allowed ? { allowed: allowed.reason } : {}), ...(known ? { pending: known.fix } : {}) })
      }
    })
  }
  return findings
}

/**
 * One entry per file and domain (the lines together): what a person reads.
 * @param {Finding[]} findings
 */
export function group(findings) {
  /** @type {Map<string, { file: string, owner: string, domain: string, lines: number[], words: Set<string>, use: string, allowed?: string, pending?: string }>} */
  const byKey = new Map()
  for (const f of findings) {
    const key = `${f.file}::${f.domain}`
    const entry = byKey.get(key) ?? { file: f.file, owner: f.owner, domain: f.domain, lines: [], words: new Set(), use: f.use, allowed: f.allowed, pending: f.pending }
    entry.lines.push(f.line)
    for (const word of f.words) entry.words.add(word)
    byKey.set(key, entry)
  }
  return [...byKey.values()].map((entry) => ({ ...entry, words: [...entry.words] }))
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const args = process.argv.slice(2)
  const valuesOf = (/** @type {string} */ flag) => args.flatMap((arg, index) => (arg === flag ? [args[index + 1]] : []))
  const findings = audit({ packages: valuesOf('--package'), domains: valuesOf('--domain') })
  const grouped = group(findings)
  const open = grouped.filter((entry) => !entry.allowed && !entry.pending)
  const known = grouped.filter((entry) => !entry.allowed && entry.pending)
  if (args.includes('--json')) {
    console.log(JSON.stringify(grouped, null, 2))
  } else {
    for (const entry of grouped) {
      const tag = entry.allowed ? 'ok  ' : entry.pending ? 'PEND' : 'FORA'
      console.log(`${tag}  ${entry.domain.padEnd(9)} ${entry.file}:${entry.lines.join(',')}  (${entry.words.join(', ')})`)
      console.log(`      ${entry.allowed ? `permitido: ${entry.allowed}` : entry.pending ? `pendente: ${entry.pending}` : `use: ${entry.use}`}`)
    }
    console.log(`\n${open.length} novos fora do SDK dono, ${known.length} pendentes conhecidos, ${grouped.length - open.length - known.length} permitidos (allowlist.json)`)
  }
  if (args.includes('--check') && open.length > 0) process.exit(1)
}
