#!/usr/bin/env node
// @ts-check
// The checks that open pages in a browser, before a push (.githooks/pre-push), on this machine. CI does not run them (CLAUDE.md, "Testes de GPU e
// navegador"): software GL on a CI runner has no real frame times and draws differently from the GPU the game runs on. In order, stopping at the first
// failure: the test room and every example area (examples/<area>/test.mjs), where every drawn piece comes from and what it costs
// (tools/kit-audit/scene.mjs and cost.mjs), and the memory cycles of the room (examples/test-room/leak.mjs).
//   node tools/gpu/browser-checks.mjs
//   PRE_PUSH_BROWSER=0          skip on purpose
//   BROWSER_CHECKS=areas,scene,leak   only these groups (default: all three)
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)

/** The areas CI used to open, with the test room first: the other pages are built over its page. */
const AREAS = [
  'test-room',
  'interactables-test-area',
  'floorplan-test-area',
  'vfx-test-area',
  'weapons-test-area',
  'characters-test-area',
  'animals-test-area',
  'vehicles-test-area',
  'vegetation-test-area',
  'urban-test-area',
  'audio-test-area',
  'weather-test-area',
  'player-test-area',
  'crowd-test-area',
  'stories-test-area',
]

/** @param {string} reason @returns {never} */
const skip = (reason) => {
  console.log(`pre-push: browser checks skipped: ${reason}`)
  process.exit(0)
}

if (process.env.PRE_PUSH_BROWSER === '0') skip('PRE_PUSH_BROWSER=0')
// a push from a CI job (the release's version bump): these checks never run on CI (CLAUDE.md section 9)
if (process.env.CI) skip('on CI')

// The page scripts load Playwright from NODE_PATH; the workspace has playwright-core inside pnpm's store
const nodePath = (() => {
  const paths = (process.env.NODE_PATH ?? '').split(delimiter).filter(Boolean)
  const store = join(root, 'node_modules/.pnpm')
  const entry = existsSync(store) ? readdirSync(store).find((name) => name.startsWith('playwright-core@')) : undefined
  if (entry) paths.push(join(store, entry, 'node_modules'))
  return paths.join(delimiter)
})()
const hasPlaywright = ['playwright', 'playwright-core'].some((id) => {
  try {
    require.resolve(id, { paths: [root, ...nodePath.split(delimiter)] })
    return true
  } catch {
    return false
  }
})
if (!hasPlaywright) skip('playwright not found (set NODE_PATH)')

const groups = new Set((process.env.BROWSER_CHECKS ?? 'areas,scene,leak').split(',').map((group) => group.trim()))

/** @param {string} label @param {string[]} args @param {Record<string, string>} [env] */
const run = (label, args, env = {}) => {
  console.log(`pre-push: ${label}`)
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', env: { ...process.env, NODE_PATH: nodePath, ...env } })
  if (result.status !== 0) {
    console.error(`pre-push: ${label} failed (skip once with PRE_PUSH_BROWSER=0 git push)`)
    process.exit(result.status ?? 1)
  }
}

for (const area of AREAS) run(`build ${area}`, [`examples/${area}/build.mjs`])
if (groups.has('areas')) for (const area of AREAS) run(`open ${area}`, [`examples/${area}/test.mjs`], { EXAMPLE_PART: '' })
if (groups.has('scene')) {
  run('where every drawn piece comes from', ['tools/kit-audit/scene.mjs', '--check'])
  run('what every piece costs to draw', ['tools/kit-audit/cost.mjs', '--check'])
}
if (groups.has('leak')) run('nothing stays in memory across cycles', ['examples/test-room/leak.mjs'], { LEAK_PHASE: '' })
console.log('pre-push: browser checks passed')
