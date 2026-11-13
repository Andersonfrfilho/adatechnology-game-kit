#!/usr/bin/env node
// @ts-check
// The z-fighting guard of the houses in the pre-commit (CLAUDE.md §13, no GPU). When the staged files touch a package the houses are drawn with (the
// floorplan renderer and every workspace package it loads, and the template packs), it builds the touched ones and runs the house sweep
// (packages/game-floorplan-three/tests/z-fighting-houses.test.ts) on the reference house (single_storey_a) and on every template of a touched template pack
// (listed from the engine's registry, never by hand), at every construction level, one seed. The whole sweep (every template, three seeds, ~10-30 min) is
// the package's test: it runs in the pre-push's CPU half when game-floorplan-three changes and in CI on every pull request.
//   ZFIGHT_PRECOMMIT=off   skip it once (the commit still goes through CI)
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const RENDERER = '@adatechnology/game-floorplan-three'
const REFERENCE = 'single_storey_a'
/** The packs that add templates, in the order the house tests register them. */
const TEMPLATE_PACKS = ['game-floorplan-residential', 'game-floorplan-commercial', 'game-floorplan-structure', 'game-floorplan-rural', 'game-floorplan-post-apocalyptic']

if (process.env.ZFIGHT_PRECOMMIT === 'off') process.exit(0)

/** @type {Map<string, { dir: string, deps: string[] }>} */
const packages = new Map()
for (const dir of readdirSync(join(ROOT, 'packages'))) {
  const file = join(ROOT, 'packages', dir, 'package.json')
  if (!existsSync(file)) continue
  const json = JSON.parse(readFileSync(file, 'utf8'))
  packages.set(json.name, { dir, deps: Object.keys({ ...json.dependencies, ...json.devDependencies, ...json.peerDependencies }) })
}

/** The renderer and every workspace package it loads, directly or through another. */
const closure = new Set([RENDERER])
for (const queue = [RENDERER]; queue.length; ) {
  for (const dep of packages.get(/** @type {string} */ (queue.pop()))?.deps ?? []) if (packages.has(dep) && !closure.has(dep)) closure.add(dep), queue.push(dep)
}
for (const dir of TEMPLATE_PACKS) closure.add(`@adatechnology/${dir}`)

const staged = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
const touched = [...closure].filter((name) => {
  const dir = packages.get(name)?.dir
  return dir && staged.some((f) => f.startsWith(`packages/${dir}/`) && !f.endsWith('.md'))
})
if (!touched.length) process.exit(0)

// the test loads the other packages from their dist: the touched ones are built first
const toBuild = touched.filter((name) => name !== RENDERER)
if (toBuild.length) {
  console.log(`pre-commit: z-fighting of the houses: building ${toBuild.join(', ')}`)
  const build = spawnSync('pnpm', toBuild.flatMap((name) => ['--filter', name]).concat(['build']), { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] })
  if (build.status !== 0) process.exit(build.status ?? 1)
}

/** The templates a pack adds to the engine, read from the registry as each pack registers. @param {readonly string[]} dirs */
async function templatesOf(dirs) {
  const { engine } = await import(pathToFileURL(join(ROOT, 'packages/game-floorplan/dist/index.js')).href)
  const ids = (/** @type {{ id: string }[]} */ list) => new Set(list.map((t) => t.id))
  /** @type {string[]} */
  const out = []
  for (const dir of TEMPLATE_PACKS) {
    const before = ids(engine.listTemplates())
    const pack = await import(pathToFileURL(join(ROOT, 'packages', dir, 'dist/index.js')).href)
    pack.register(engine, { region: 'br' })
    if (dirs.includes(dir)) for (const t of engine.listTemplates()) if (!before.has(t.id) && (t.floorRange?.[0] ?? 1) < 10) out.push(t.id)
  }
  return out
}

const packs = TEMPLATE_PACKS.filter((dir) => touched.includes(`@adatechnology/${dir}`))
const templates = [...new Set([REFERENCE, ...(packs.length ? await templatesOf(packs) : [])])]
console.log(`pre-commit: z-fighting of the houses (${templates.join(', ')}, every construction level)`)
const run = spawnSync('pnpm', ['--filter', RENDERER, 'exec', 'vitest', 'run', 'tests/z-fighting-houses.test.ts', '--reporter=dot'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, ZFIGHT_TEMPLATES: templates.join(','), ZFIGHT_SEEDS: '1' },
})
if (run.status !== 0) {
  console.log('pre-commit: z-fighting of the houses failed: two faces closer than the depth buffer tells apart (see above, specs/regras/13-sem-z-fighting.md)')
  process.exit(run.status ?? 1)
}
