#!/usr/bin/env node
// @ts-check
// The daily GPU run on main (dono, 2026-11-06): the suites that open the whole room (test-room, scene, cost, leak) and the frame budgets
// (perf-gate.mjs) left the pre-push, which now runs only the areas a branch touches. Once a day, early in the morning, this script checks out the
// newest origin/main in its own worktree, waits until the machine is idle, on the charger and with no push in flight, builds it and runs the whole battery, comparing the
// frame times against the last main that passed here, on this same machine. Each run writes a folder per date with the logs and a STATUS file, and a
// failure raises a desktop notice. Scheduled by the user systemd timer in tools/gpu/systemd/ (install-nightly.sh).
//   node tools/gpu/nightly-gpu.mjs              run now; it waits for an idle machine first, then takes the GPU lock of the pre-push for the whole run
//   NIGHTLY_REF=<ref>                           measure another ref (default origin/main)
//   NIGHTLY_REPORTS=<dir>                       where the dated folders go (default ~/Documents/personal/adatechnology-game-kit-shots/nightly)
//   NIGHTLY_MAX_LOAD=2  NIGHTLY_WAIT_MIN=240    the 1-minute load it waits below, and for how long at most
//   NIGHTLY_STALE_PUSH_MIN=90                   a `git push` older than this, or only waiting on a lock, or running while nobody holds gpu.lock, does not hold the run back
import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { cpus, homedir, loadavg } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { batterySkipReason } from './power.mjs'
import { gpuLockIsFree, judgePushes, readProcesses } from './push-guard.mjs'
import { assertNightlyBuildsItsOwnPage, baseSkipReportOf, trySaveBase } from './room-explosion-base.mjs'
import { parseSummaryLines } from './suite-runner.mjs'

/** The explosives the daily run times in the room (`room-explosion`): the C4 keeps the report and base names it always had, the others get theirs. */
const NIGHTLY_EXPLOSIVES = /** @type {const} */ (['c4', 'm67'])

/** @typedef {{ lastPassed?: string, lastRun?: string, lastStatus?: string, baseSkipNotified?: string[] }} NightlyState */
/** @typedef {{ name: string, ok: boolean, log: string, seconds: number }} StepResult */

assertNightlyBuildsItsOwnPage(process.env)

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const cacheDir = join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'adatechnology-game-kit')
const tree = join(cacheDir, 'nightly-worktree')
const stateFile = join(cacheDir, 'nightly-state.json')
const reportsRoot = process.env.NIGHTLY_REPORTS ?? join(homedir(), 'Documents/personal/adatechnology-game-kit-shots/nightly')
const ref = process.env.NIGHTLY_REF ?? 'origin/main'
const MAX_LOAD = Number(process.env.NIGHTLY_MAX_LOAD ?? Math.max(2, cpus().length / 4))
const WAIT_MINUTES = Number(process.env.NIGHTLY_WAIT_MIN ?? 240)
const STALE_PUSH_MINUTES = Number(process.env.NIGHTLY_STALE_PUSH_MIN ?? 90)
const POLL_MS = 60_000
const GPU_LOCK = join(cacheDir, 'gpu.lock')

const today = new Date().toISOString().slice(0, 10)
const reportDir = join(reportsRoot, today)
mkdirSync(reportDir, { recursive: true })
const summary = join(reportDir, 'summary.md')

/** @param {string} line */
const note = (line) => {
  console.log(`nightly: ${line}`)
  appendFileSync(summary, `${line}\n`)
}

/** @returns {NightlyState} */
const readState = () => {
  try {
    return JSON.parse(readFileSync(stateFile, 'utf8'))
  } catch {
    return {}
  }
}

/** @param {string[]} args @param {string} [cwd] */
const git = (args, cwd = repo) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

/** @param {string} title @param {string} body */
const notify = (title, body) => {
  spawnSync('notify-send', ['--urgency=critical', '--app-name=game-kit', title, body], { stdio: 'ignore' })
}

const sleep = (/** @type {number} */ ms) => new Promise((done) => setTimeout(done, ms))

/** The pushes that hold the run back (a push waiting on a lock keeps the load low, so the load alone would let the run take the lock first), and the ones it ignores, with why. */
const pushes = () => judgePushes({ procs: readProcesses(), staleMinutes: STALE_PUSH_MINUTES, gpuLockFree: gpuLockIsFree(GPU_LOCK) })

/** Waits for the charger, no push in flight and a quiet machine, so the frame times compare with the last run; gives up after WAIT_MINUTES. */
async function waitUntilIdle() {
  const deadline = Date.now() + WAIT_MINUTES * 60_000
  const noted = new Set()
  for (;;) {
    const battery = batterySkipReason({})
    const load = loadavg()[0] ?? 0
    const { blocking, ignored } = pushes()
    for (const push of ignored) if (!noted.has(push.pid)) (noted.add(push.pid), note(`ignoring git push ${push.pid}: ${push.reason}`))
    if (!battery && !blocking.length && load < MAX_LOAD) return null
    if (Date.now() > deadline) return battery ?? (blocking.length ? `an active push (${blocking.map((push) => `${push.pid}: ${push.reason}`).join('; ')}) was still running after ${WAIT_MINUTES} min` : `load ${load.toFixed(2)} stayed over ${MAX_LOAD} for ${WAIT_MINUTES} min`)
    await sleep(POLL_MS)
  }
}

/** @param {{ name: string, command: string, args: string[], env?: NodeJS.ProcessEnv }} step @returns {StepResult} */
function run(step) {
  const log = join(reportDir, `${step.name}.log`)
  const started = Date.now()
  const result = spawnSync(step.command, step.args, { cwd: tree, env: { ...process.env, ...step.env }, encoding: 'utf8', maxBuffer: 1 << 30 })
  writeFileSync(log, `${result.stdout ?? ''}${result.stderr ?? ''}`)
  const seconds = Math.round((Date.now() - started) / 1000)
  const ok = result.status === 0
  note(`- ${step.name}: ${ok ? 'ok' : `FAILED (exit ${result.status ?? result.signal})`} in ${seconds} s (${log})`)
  if (step.name === 'browser-checks') for (const suite of parseSummaryLines(result.stdout ?? '')) note(`  - ${suite.label}: ${suite.result}`)
  return { name: step.name, ok, log, seconds }
}

/** A detached worktree of the ref, kept between runs (pnpm links from the store, so the next install is quick). @param {string} sha */
function checkout(sha) {
  if (!existsSync(join(tree, '.git'))) git(['worktree', 'add', '--force', '--detach', tree, sha])
  else {
    git(['checkout', '--force', '--detach', sha], tree)
    git(['clean', '-fdq', '-e', 'node_modules'], tree)
  }
}

/** Waits for an idle machine without the lock (a push in the queue would keep the load up and never get it), then runs again under the lock. */
async function underLock() {
  writeFileSync(summary, `# GPU daily run ${today}\n\n`)
  const notRun = await waitUntilIdle()
  if (notRun) {
    note(`not run: ${notRun}`)
    writeFileSync(join(reportDir, 'STATUS'), `SKIPPED ${notRun}\n`)
    notify('game-kit: GPU daily run skipped', notRun)
    return 0
  }
  mkdirSync(cacheDir, { recursive: true })
  const locked = spawnSync('flock', [GPU_LOCK, process.execPath, fileURLToPath(import.meta.url)], { stdio: 'inherit', env: { ...process.env, NIGHTLY_LOCKED: '1' } })
  return locked.status ?? 1
}

async function main() {
  git(['fetch', '-q', 'origin', 'main'])
  const sha = git(['rev-parse', ref])
  const state = readState()
  let baseSkipNotified = state.baseSkipNotified ?? []
  note(`commit: ${sha} (${ref}); compared with the last main that passed here: ${state.lastPassed ?? 'none yet'}`)
  checkout(sha)
  const quiet = { PRE_PUSH_ON_BATTERY: '1' }
  const steps = [
    { name: 'install', command: 'pnpm', args: ['install', '--frozen-lockfile'] },
    { name: 'build', command: 'pnpm', args: ['-s', 'build'] },
    { name: 'browser-checks', command: 'node', args: ['tools/gpu/browser-checks.mjs'], env: { ...quiet, GPU_SCOPE: 'nightly', PRE_PUSH_BROWSER: 'all' } },
  ]
  /** @type {StepResult[]} */
  const results = []
  for (const step of steps) {
    const result = run(step)
    results.push(result)
    if (!result.ok && step.name !== 'browser-checks') break
  }
  if (results.every((result) => result.ok || result.name === 'browser-checks') && results.length === steps.length) {
    // the frame times against the last main that passed here; the first run, or main unchanged, compares with itself (absolute targets in the report)
    const base = state.lastPassed && state.lastPassed !== sha ? state.lastPassed : sha
    results.push(run({ name: 'perf-gate', command: 'node', args: ['tools/gpu/perf-gate.mjs'], env: { ...quiet, PERF_GATE_BASE: base } }))
    // spec 008 B6: the physics of the house explosion against its budget, at 1x CPU (blocks) and at 2x, 4x and 6x (reported: the proxy for a weaker machine)
    // FRAME_PARTS=1 arms the explosion-frame gate (f0 and the frames after it, in the page's deadline mode) at the cost of a render per frame in the stage pass; a base in another mode is not compared and is rewritten
    // the base keeps the best of the passing nights (room-explosion-base.mjs): copying each night over it let a slow drift pass forever
    // the 5 ms goal is only a warning (main is still over it, so blocking on it failed every night): it blocks on a regression against the last report that passed
    // the C4 against the house (the old reference) and the M67, the case the frame goal of spec 018 is measured on (D3): each with its own report and base, so a
    // regression of the spread M67 blast fails the night too
    for (const explosive of NIGHTLY_EXPLOSIVES) {
      const suffix = explosive === 'c4' ? '' : `-${explosive}`
      const explosionOut = join(reportDir, `room-explosion${suffix}.json`)
      const explosionBase = join(cacheDir, `room-explosion-base${suffix}.json`)
      const explosion = run({ name: `room-explosion${suffix}`, command: 'node', args: ['tools/gpu/perf-gate.mjs', 'room-explosion'], env: { ...quiet, ROOM_EXPLOSION_FRAME_PARTS: '1', ROOM_EXPLOSION_EXPLOSIVE: explosive, ROOM_EXPLOSION_OUT: explosionOut, ...(existsSync(explosionBase) ? { ROOM_EXPLOSION_BASE: explosionBase } : {}) } })
      results.push(explosion)
      if (!explosion.ok || !existsSync(explosionOut)) continue
      const saved = trySaveBase(explosionOut, explosionBase, sha)
      if (!saved.ok) {
        note(`- room-explosion-base${suffix}: FAILED, the base was not saved: ${saved.reason}`)
        results.push({ name: `room-explosion-base${suffix}`, ok: false, log: explosionOut, seconds: 0 })
      } else if (saved.skipped && saved.pair) {
        // the night itself was valid, so it does not fail; the line is written every night, the notification once per (base GPU/driver, current GPU/driver) pair
        const said = baseSkipReportOf({ skipped: saved.skipped, pair: saved.pair, notified: baseSkipNotified })
        note(said.line)
        if (said.notification) notify(said.notification.title, said.notification.body)
        baseSkipNotified = said.notified
      }
    }
  }
  const failed = results.filter((result) => !result.ok)
  const status = failed.length ? `FAILED ${failed.map((result) => result.name).join(', ')}` : 'PASSED'
  writeFileSync(join(reportDir, 'STATUS'), `${status} ${sha}\n`)
  note(`\n**${status}**`)
  writeFileSync(stateFile, JSON.stringify({ ...state, baseSkipNotified, lastRun: sha, lastStatus: status, ...(failed.length ? {} : { lastPassed: sha }) }, null, 2))
  if (failed.length) notify('game-kit: GPU daily run FAILED', `${status} on ${sha.slice(0, 9)}; see ${summary}`)
  return failed.length ? 1 : 0
}

process.exit(process.env.NIGHTLY_LOCKED ? await main() : await underLock())
