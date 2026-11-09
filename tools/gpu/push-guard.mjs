// @ts-check
// Whether a `git push` should hold the daily run back (tools/gpu/nightly-gpu.mjs). Only a push that is young, past its checks' queue and using the GPU
// counts: a push stuck for hours, a `timeout ... git push` sitting in a shell, or a pre-push only waiting on a lock must not stop the run, or it starves.
// The decision is a pure function of the process list and the lock state; readProcesses and gpuLockIsFree read them from the machine.
import { spawnSync } from 'node:child_process'

/** @typedef {{ pid: number, ppid: number, etimes: number, args: string }} Proc */
/** @typedef {{ pid: number, seconds: number, reason: string }} PushVerdict */

const PUSH = /^(\S*\/)?git\s+(-\S+\s+)*push(\s|$)/
const FLOCK = /^(\S*\/)?flock(\s|$)/

/** @param {string} text `ps -eo pid=,ppid=,etimes=,args=` output @returns {Proc[]} */
export function parseProcesses(text) {
  /** @type {Proc[]} */
  const procs = []
  for (const line of text.split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(line)
    if (match) procs.push({ pid: Number(match[1]), ppid: Number(match[2]), etimes: Number(match[3]), args: match[4] ?? '' })
  }
  return procs
}

/** @param {Proc[]} procs @param {number} root @returns {Proc[]} every descendant of root */
function descendants(procs, root) {
  /** @type {Proc[]} */
  const found = []
  const queue = [root]
  while (queue.length) {
    const parent = queue.shift()
    for (const proc of procs) if (proc.ppid === parent) (found.push(proc), queue.push(proc.pid))
  }
  return found
}

/** A flock with no child is still waiting for its lock; once it holds it, it runs the command as a child. @param {Proc[]} procs @param {number} pushPid */
const waitingOnLock = (procs, pushPid) =>
  descendants(procs, pushPid).some((proc) => FLOCK.test(proc.args) && !procs.some((other) => other.ppid === proc.pid))

/**
 * @param {{ procs: Proc[], staleMinutes: number, gpuLockFree: boolean }} input
 * @returns {{ blocking: PushVerdict[], ignored: PushVerdict[] }} the pushes that hold the run back, and those it ignores with the reason
 */
export function judgePushes({ procs, staleMinutes, gpuLockFree }) {
  /** @type {PushVerdict[]} */
  const blocking = []
  /** @type {PushVerdict[]} */
  const ignored = []
  for (const proc of procs.filter((candidate) => PUSH.test(candidate.args))) {
    const verdict = { pid: proc.pid, seconds: proc.etimes, reason: '' }
    if (proc.etimes > staleMinutes * 60) ignored.push({ ...verdict, reason: `stale: running ${Math.round(proc.etimes / 60)} min, over ${staleMinutes}` })
    else if (waitingOnLock(procs, proc.pid)) ignored.push({ ...verdict, reason: 'only waiting on a lock' })
    else if (gpuLockFree) ignored.push({ ...verdict, reason: 'nobody holds gpu.lock, so it is not using the GPU' })
    else blocking.push({ ...verdict, reason: `active for ${Math.round(proc.etimes / 60)} min while gpu.lock is held` })
  }
  return { blocking, ignored }
}

/** @returns {Proc[]} */
export function readProcesses() {
  return parseProcesses(spawnSync('ps', ['-eo', 'pid=,ppid=,etimes=,args='], { encoding: 'utf8' }).stdout ?? '')
}

/** Taking the lock for a moment succeeds only when nobody holds it. Without flock (not Linux) nothing queues, so it counts as free. @param {string} lockFile */
export function gpuLockIsFree(lockFile) {
  const probe = spawnSync('flock', ['-n', lockFile, 'true'], { stdio: 'ignore' })
  return probe.error ? true : probe.status === 0
}
