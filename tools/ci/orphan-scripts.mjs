#!/usr/bin/env node
// @ts-check
// Copyright (c) 2026 Ada Technology. PolyForm Noncommercial 1.0.0.
// A browser script nothing calls guards nothing: every `examples/<area>/*.mjs` is named by something that runs (the daily run, `pnpm check:<area>`,
// a hook, a workflow, another script), or is in orphan-scripts-known.json, which only goes down.
//   node tools/ci/orphan-scripts.mjs --check    fails on a new orphan, and on a known one that is called now (drop it from the list)
//   node tools/ci/orphan-scripts.mjs --update   drops from the list what is called now (never adds)
//   node tools/ci/orphan-scripts.mjs            lists every orphan
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../..')
const KNOWN_FILE = join(HERE, 'orphan-scripts-known.json')
/** What the suite runners build by name for every area (`examples/${area}/test.mjs`, `build.mjs`): never spelled out one by one. */
const ENTRY_POINTS = new Set(['build.mjs', 'test.mjs'])
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'shots', 'fixtures', 'src'])

/** @param {string} directory @param {(name: string) => boolean} keep @returns {string[]} */
function filesUnder(directory, keep) {
  if (!existsSync(directory)) return []
  /** @type {string[]} */
  const found = []
  for (const name of readdirSync(directory)) {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(name)) found.push(...filesUnder(path, keep))
    } else if (keep(name)) found.push(path)
  }
  return found
}

/** @param {string} path @returns {string} */
const relative = (path) => path.slice(ROOT.length + 1)
/** @param {string} name @returns {boolean} */
const isScript = (name) => name.endsWith('.mjs')

const areas = readdirSync(join(ROOT, 'examples')).filter((name) => statSync(join(ROOT, 'examples', name)).isDirectory())
/** The scripts of each area, by area. @type {Map<string, string[]>} */
const scriptsByArea = new Map(areas.map((area) => [area, readdirSync(join(ROOT, 'examples', area)).filter(isScript)]))

/** Everything that runs, as text: the tools, the hooks, the workflows and the scripts of the root package. */
const runners = [
  ...filesUnder(join(ROOT, 'tools'), (name) => isScript(name) || name === 'package.json').filter((path) => path !== fileURLToPath(import.meta.url)),
  ...filesUnder(join(ROOT, '.githooks'), () => true),
  ...filesUnder(join(ROOT, '.github'), (name) => name.endsWith('.yml')),
  join(ROOT, 'package.json'),
].map((path) => readFileSync(path, 'utf8'))

/** @param {string} area @param {string} script @returns {boolean} */
function isCalled(area, script) {
  if (ENTRY_POINTS.has(script)) return true
  if (runners.some((text) => text.includes(`${area}/${script}`))) return true
  // inside its own area a script is called by its bare name: imported by another script, or run by the area's package.json
  const siblings = (scriptsByArea.get(area) ?? []).filter((other) => other !== script).map((other) => join(ROOT, 'examples', area, other))
  const ownPackage = join(ROOT, 'examples', area, 'package.json')
  const neighbours = existsSync(ownPackage) ? [...siblings, ownPackage] : siblings
  if (neighbours.some((path) => readFileSync(path, 'utf8').includes(script))) return true
  // or by another area, by its path
  return areas.some((other) => other !== area && (scriptsByArea.get(other) ?? []).some((name) => readFileSync(join(ROOT, 'examples', other, name), 'utf8').includes(`${area}/${script}`)))
}

const orphans = areas.flatMap((area) => (scriptsByArea.get(area) ?? []).filter((script) => !isCalled(area, script)).map((script) => relative(join(ROOT, 'examples', area, script)))).sort()
/** @type {string[]} */
const known = JSON.parse(readFileSync(KNOWN_FILE, 'utf8'))
const added = orphans.filter((path) => !known.includes(path))
const paid = known.filter((path) => !orphans.includes(path))

if (process.argv.includes('--update')) {
  writeFileSync(KNOWN_FILE, `${JSON.stringify(known.filter((path) => orphans.includes(path)), null, 2)}\n`)
  console.log(`orphan scripts: ${paid.length} dropped from the list, ${orphans.length - added.length} left`)
  if (added.length) console.error(`orphan scripts: not added (the list only goes down): ${added.join(', ')}`)
  process.exit(added.length ? 1 : 0)
}
if (!process.argv.includes('--check')) {
  for (const path of orphans) console.log(path)
  process.exit(0)
}
/** @type {string[]} */
const problems = [
  ...added.map((path) => `${path}: nothing calls it. Add it to tools/gpu/browser-checks.mjs (the daily run), call it from the area's test.mjs, or delete it`),
  ...paid.map((path) => `${path}: is called now (or gone): drop it from tools/ci/orphan-scripts-known.json (--update)`),
]
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`orphan scripts: no new one, ${known.length} known (tools/ci/orphan-scripts-known.json, only goes down)`)
