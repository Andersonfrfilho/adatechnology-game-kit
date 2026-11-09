#!/usr/bin/env node
// @ts-check
// The checks that open pages in a browser, before a push (.githooks/pre-push), on this machine. CI does not run them (CLAUDE.md, "Testes de GPU e
// navegador"): software GL on a CI runner has no real frame times and draws differently from the GPU the game runs on. In order, going on after a failure
// (the pre-push no longer calls this file; it lists every failing step at the end, BROWSER_CHECKS_FAIL_FAST=1 stops at the first): the test room and every example area (examples/<area>/test.mjs), where every drawn piece comes from and what it costs
// (tools/kit-audit/scene.mjs and cost.mjs), and the memory cycles of the room (examples/test-room/leak.mjs). Only the suites whose pages the branch changes
// run (tools/gpu/select-suites.mjs, from the diff against origin/main); the list and the reason are printed first.
//   node tools/gpu/browser-checks.mjs
//   PRE_PUSH_BROWSER=0          skip on purpose
//   on battery they skip with a message (tools/gpu/power.mjs); PRE_PUSH_ON_BATTERY=1 runs them anyway
//   PRE_PUSH_BROWSER=all        every suite, whatever the branch changed (also PRE_PUSH_ALL=1)
//   BROWSER_CHECKS=areas,scene,leak   only these groups (default: all three)
//   BROWSER_CHECKS_FAIL_FAST=1  stop at the first failing step instead of running the rest
//   GPU_SCOPE=nightly           also the suites that open the whole room (test-room, scene, cost, leak); a push leaves them to tools/gpu/nightly-gpu.mjs
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { batterySkipReason } from './power.mjs'
import { readWorkspace, selectSuites, splitForPush, SUITES } from './select-suites.mjs'
import { runSteps, summaryLine } from './suite-runner.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)

/** @param {string} reason @returns {never} */
const skip = (reason) => {
  console.log(`pre-push: browser checks skipped: ${reason}`)
  process.exit(0)
}

if (process.env.PRE_PUSH_BROWSER === '0') skip('PRE_PUSH_BROWSER=0')
// a push from a CI job (the release's version bump): these checks never run on CI (CLAUDE.md section 9)
if (process.env.CI) skip('on CI')
// on battery the GPU throttles and an hour of suites drains it: they run on the charger only, the push is not blocked (tools/gpu/power.mjs)
const onBattery = batterySkipReason()
if (onBattery) skip(onBattery)

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
const groups = new Set((process.env.BROWSER_CHECKS ?? 'areas,scene,leak').split(',').map((group) => group.trim()))

/** @param {import('./suite-runner.mjs').Step} step @returns {number} */
const exec = (step) => {
  console.log(`pre-push: ${step.label}`)
  const result = spawnSync(process.execPath, step.args, { cwd: root, stdio: 'inherit', env: { ...process.env, NODE_PATH: nodePath, ...step.env } })
  if (result.status !== 0) console.error(`pre-push: ${step.label} failed`)
  return result.status ?? 1
}

/** The files the branch changed since it left origin/main, or null when there is no base to compare with. @returns {string[] | null} */
const changedFiles = () => {
  try {
    const base = execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { cwd: root, encoding: 'utf8' }).trim()
    return execFileSync('git', ['diff', '--name-only', base, 'HEAD'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)
  } catch {
    return null
  }
}
const forced = process.env.PRE_PUSH_BROWSER === 'all' || Boolean(process.env.PRE_PUSH_ALL)
const changed = forced ? null : changedFiles()
const selection =
  changed === null
    ? { all: true, reason: forced ? 'PRE_PUSH_BROWSER=all' : 'no merge base with origin/main', suites: SUITES.map((suite) => ({ id: suite.id, reasons: [] })) }
    : selectSuites(readWorkspace(root), changed)
const { run: forThisRun, left: leftToNightly } = splitForPush(selection, process.env.GPU_SCOPE === 'nightly')
const chosen = new Set(forThisRun.filter((picked) => groups.has(SUITES.find((suite) => suite.id === picked.id)?.group ?? '')).map((picked) => picked.id))
console.log(`pre-push: browser suites: ${chosen.size} of ${SUITES.length} (${selection.all ? `all: ${selection.reason}` : selection.reason})`)
for (const picked of forThisRun) if (chosen.has(picked.id) && !selection.all) console.log(`pre-push:   ${picked.id}: ${picked.reasons.join(', ')}`)
if (leftToNightly.length) console.log(`pre-push:   left to the daily run (tools/gpu/nightly-gpu.mjs): ${leftToNightly.join(', ')}`)
const skipped = SUITES.filter((suite) => !chosen.has(suite.id) && !leftToNightly.includes(suite.id)).map((suite) => suite.id)
if (skipped.length) console.log(`pre-push:   skipped: ${skipped.join(', ')}`)
if (chosen.size === 0) skip('nothing the branch changed is loaded by a page')
if (!hasPlaywright) skip('playwright not found (set NODE_PATH)')

const areas = SUITES.filter((suite) => suite.group === 'areas' && chosen.has(suite.id)).map((suite) => suite.id)
// every page is built over the test room's page, and scene, cost and leak open it
/** @type {import('./suite-runner.mjs').Step[]} */
const steps = [{ label: 'build test-room', args: ['examples/test-room/build.mjs'], fatal: true }]
for (const area of areas) if (area !== 'test-room') steps.push({ label: `build ${area}`, args: [`examples/${area}/build.mjs`] })
for (const area of areas) steps.push({ label: `open ${area}`, args: [`examples/${area}/test.mjs`], env: { EXAMPLE_PART: '' }, needs: `build ${area}` })
if (chosen.has('scene')) steps.push({ label: 'where every drawn piece comes from', args: ['tools/kit-audit/scene.mjs', '--check'] })
if (chosen.has('cost')) steps.push({ label: 'what every piece costs to draw', args: ['tools/kit-audit/cost.mjs', '--check'] })
if (chosen.has('leak')) steps.push({ label: 'nothing stays in memory across cycles', args: ['examples/test-room/leak.mjs'], env: { LEAK_PHASE: '' } })
const { outcomes, failed, exitCode } = runSteps({ steps, exec, failFast: Boolean(process.env.BROWSER_CHECKS_FAIL_FAST) })
console.log('browser-checks: summary')
for (const outcome of outcomes) console.log(summaryLine(outcome))
if (failed.length) {
  console.error(`browser-checks: ${failed.length} failed: ${failed.map((outcome) => `${outcome.label} (exit ${outcome.code})`).join('; ')}`)
  process.exit(exitCode)
}
console.log('pre-push: browser checks passed')
