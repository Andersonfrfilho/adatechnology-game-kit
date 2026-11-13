#!/usr/bin/env node
// Every package that draws pieces walks its whole catalog through the z-fighting guard (CLAUDE.md §13): a `*-three` package (or one with
// an exact golden of its pieces) has tests/catalog-cases.ts and tests/z-fighting.test.ts, or is in exempt.json with the reason.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
/** @type {Record<string, string>} */
const exempt = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'exempt.json'), 'utf8'))
const packages = readdirSync(join(ROOT, 'packages'))

/** @param {string} name */
const drawsPieces = (name) => name.endsWith('-three') || existsSync(join(ROOT, 'packages', name, 'tests/exact-golden.test.ts'))
/** Packages whose scenes are not a list of catalog cases: houses (every template, level and seed) and the ground (heaps, holes, loose earth). @type {Record<string, string[]>} */
const GUARD_FILES = {
  'game-floorplan-three': ['tests/z-fighting-houses.test.ts', 'tests/helpers/z-fighting-houses.ts'],
  'game-terrain-three': ['tests/z-fighting.test.ts', 'tests/fixtures/z-fighting-ledger.json'],
}
/** @param {string} name */
const guarded = (name) => (GUARD_FILES[name] ?? ['tests/catalog-cases.ts', 'tests/z-fighting.test.ts']).every((f) => existsSync(join(ROOT, 'packages', name, f)))

/** @type {string[]} */
const problems = []
for (const name of packages.filter(drawsPieces)) {
  if (guarded(name) && exempt[name]) problems.push(`${name}: has the z-fighting guard, drop it from tools/z-fighting/exempt.json`)
  if (!guarded(name) && !exempt[name]) problems.push(`${name}: draws pieces but has no z-fighting guard (tests/catalog-cases.ts + tests/z-fighting.test.ts, see CLAUDE.md §13)`)
}
for (const name of Object.keys(exempt)) if (!packages.includes(name)) problems.push(`${name}: in tools/z-fighting/exempt.json but not a package`)

if (problems.length) {
  console.error(`z-fighting coverage:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`z-fighting coverage: ${packages.filter(drawsPieces).filter(guarded).length} packages guarded, ${Object.keys(exempt).length} exempt with a reason`)
