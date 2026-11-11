#!/usr/bin/env node
// @ts-check
// One command per test area: build what its page loads, run the unit tests of those packages and open the page in the browser, which writes the prints.
//   pnpm check:floorplan                 (the same as node tools/check-area/check-area.mjs floorplan)
//   pnpm check:floorplan --no-browser    build and unit tests only (no GPU, no Chromium)
//   pnpm check:floorplan --no-unit       build and the page only
//   pnpm check:floorplan --room          build the test room page again even when it exists (examples/test-room/base/test-room.html)
//   node tools/check-area/check-area.mjs --list
// The page test opens a browser, so it never runs on CI or in the pre-push (CLAUDE.md section 9): this command is for the machine with the GPU, by hand.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { delimiter, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { listAreas, pagePackages, planCheck, ROOM_ENTRY_FOLDER, ROOM_FOLDER } from './plan.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const args = process.argv.slice(2)
const areas = listAreas(root)
const usage = `usage: pnpm check:<area> [--no-browser] [--no-unit] [--room]\nareas: ${areas.map((area) => area.id).join(', ')}`

if (args.includes('--list')) {
  for (const area of areas) console.log(`${area.id.padEnd(18)} examples/${area.folder}`)
  process.exit(0)
}
const wanted = args.find((arg) => !arg.startsWith('-'))
const area = areas.find((candidate) => candidate.id === wanted || candidate.folder === wanted)
if (!area) {
  console.error(wanted ? `check-area: unknown area "${wanted}"\n${usage}` : usage)
  process.exit(2)
}

const packages = readdirSync(join(root, 'packages')).filter((name) => existsSync(join(root, 'packages', name, 'package.json')))
/** @param {string} folder @returns {string[]} */
const packagesOf = (folder) => {
  const at = join(root, 'examples', folder)
  const build = existsSync(join(at, 'build.mjs')) ? readFileSync(join(at, 'build.mjs'), 'utf8') : ''
  return pagePackages({ manifest: readFileSync(join(at, 'package.json'), 'utf8'), build, packages })
}
const roomPackages = [...new Set([...packagesOf(ROOM_FOLDER), ...packagesOf(ROOM_ENTRY_FOLDER)])].sort()
const steps = planCheck({
  area,
  packages: area.folder === ROOM_FOLDER ? roomPackages : packagesOf(area.folder),
  roomPackages,
  roomBuilt: existsSync(join(root, 'examples', ROOM_FOLDER, 'base', 'test-room.html')),
  flags: { unit: !args.includes('--no-unit'), browser: !args.includes('--no-browser'), room: args.includes('--room') },
})

// The page tests load Playwright from NODE_PATH; the workspace has playwright-core inside pnpm's store (as tools/gpu/browser-checks.mjs does)
const nodePath = (() => {
  const paths = (process.env.NODE_PATH ?? '').split(delimiter).filter(Boolean)
  const store = join(root, 'node_modules/.pnpm')
  const entry = existsSync(store) ? readdirSync(store).find((name) => name.startsWith('playwright-core@')) : undefined
  if (entry) paths.push(join(store, entry, 'node_modules'))
  return paths.join(delimiter)
})()

const started = Date.now()
console.log(`check-area: ${area.id} (examples/${area.folder}), ${steps.length} steps`)
for (const [index, step] of steps.entries()) {
  const stepStart = Date.now()
  console.log(`\ncheck-area: [${index + 1}/${steps.length}] ${step.label}`)
  const command = step.command === 'node' ? process.execPath : step.command
  const result = spawnSync(command, step.args, { cwd: root, stdio: 'inherit', env: { ...process.env, NODE_PATH: nodePath, ...step.env } })
  const seconds = ((Date.now() - stepStart) / 1000).toFixed(0)
  if (result.status !== 0) {
    console.error(`\ncheck-area: FAILED after ${seconds}s: ${step.label} (${step.command} ${step.args.join(' ')})`)
    process.exit(result.status ?? 1)
  }
  console.log(`check-area: ok in ${seconds}s: ${step.label}`)
}

const shots = join(root, 'examples', area.folder, 'shots')
const fresh = existsSync(shots)
  ? readdirSync(shots, { recursive: true, encoding: 'utf8' })
      .map((name) => join(shots, name))
      .filter((path) => /\.(png|jpe?g)$/i.test(path) && statSync(path).mtimeMs >= started)
  : []
console.log(`\ncheck-area: ${area.id} passed in ${((Date.now() - started) / 1000).toFixed(0)}s`)
if (fresh.length) {
  console.log(`check-area: ${fresh.length} prints written:`)
  for (const path of fresh) console.log(`  ${relative(root, path)}`)
}
