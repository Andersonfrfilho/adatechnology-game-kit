// The two traps of a frame-time measure, for every harness that takes one without going through perf-gate: the machine-wide lock (one measure at a
// time, whatever the worktree) and a quiet machine (1-minute load under QUIET_LOAD). Pure decisions here, so tests/measure-lock.test.mjs can hold them.
// A caller that already holds the lock (`flock ~/.cache/adatechnology-game-kit/perf-measure.lock node ...`) must set PERF_MEASURE_LOCKED=1, or the harness waits for itself.
import { spawnSync } from 'node:child_process'
import { homedir, loadavg } from 'node:os'
import { join } from 'node:path'

import { WAIT_FOR_QUIET_MS } from './perf-gate-plan.mjs'

export const MEASURE_LOCK = join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'adatechnology-game-kit', 'perf-measure.lock')
export const MEASURE_LOCKED_ENV = 'PERF_MEASURE_LOCKED'
// the budgets hold for a quiet machine: other work on the CPU reads as a slow frame
export const QUIET_LOAD = 4
export const QUIET_POLL_MS = 30000

/**
 * Whether this process must run again under the lock. Not when the caller holds it (the flag), and not without flock (not Linux): it runs unlocked, as push-guard does.
 * @param {{ env: NodeJS.ProcessEnv, hasFlock: boolean }} state @returns {'run' | 'reexec'}
 */
export const lockDecision = ({ env, hasFlock }) => (env[MEASURE_LOCKED_ENV] === '1' || !hasFlock ? 'run' : 'reexec')

/** @returns {boolean} */
export const flockExists = () => !spawnSync('flock', ['--version'], { stdio: 'ignore' }).error

/**
 * Runs `script` again under the lock and returns its exit status. @param {string} script @param {string[]} args
 * @returns {number}
 */
export const rerunUnderLock = (script, args) => {
  const run = spawnSync('flock', [MEASURE_LOCK, process.execPath, script, ...args], { stdio: 'inherit', env: { ...process.env, [MEASURE_LOCKED_ENV]: '1' } })
  return run.status ?? 1
}

/**
 * Waits for the 1-minute load to fall under QUIET_LOAD, up to `maxMs`; says when it gives up. Returns the load at the start and whether the machine is still busy.
 * @param {{ label: string, load?: () => number, now?: () => number, sleep?: (ms: number) => Promise<void>, log?: (line: string) => void, maxMs?: number, quietLoad?: number }} options
 * @returns {Promise<{ loadAtStart: number, busy: boolean }>}
 */
export const waitForQuietMachine = async ({ label, load = () => loadavg()[0] ?? 0, now = Date.now, sleep = (ms) => new Promise((done) => setTimeout(done, ms)), log = console.log, maxMs = WAIT_FOR_QUIET_MS, quietLoad = QUIET_LOAD }) => {
  const loadAtStart = load()
  const until = now() + maxMs
  while (load() >= quietLoad && now() < until) {
    log(`${label}: waiting for a quiet machine (load ${load().toFixed(1)}, under ${quietLoad} wanted)`)
    await sleep(QUIET_POLL_MS)
  }
  const busy = load() >= quietLoad
  if (busy) log(`${label}: the machine is still busy (load ${load().toFixed(1)}, under ${quietLoad} wanted): the frame times below read slower than a player sees`)
  return { loadAtStart, busy }
}
