#!/usr/bin/env node
// @ts-check
// The frame budgets of examples/test-room/perf.mjs on this machine's own GPU, before a push (.githooks/pre-push). CI has no GPU, so the frame times are
// checked here. A machine without a GPU, where WebGL falls back to software (SwiftShader, llvmpipe), skips with a message; PRE_PUSH_PERF=0 skips on purpose.
//
// What blocks: (1) a hard failure of perf.mjs (a shader linked in play, a page error, a light in the wrong slot, a horde that does not do what its phase is
// for), on any machine; (2) a phase more than 10% worse than origin/main measured on this same machine, same GPU, same window (frame p99, worst frame,
// worst long task, frames over 33 ms, draws, buffers, the crowd step). The absolute budgets of perf.mjs (p99 20 ms, no frame over 33 ms, ...) stay in the
// report as the target: a laptop on battery, an iGPU or a 4K window reads slower than the reference machine without the branch being worse, and a fixed
// number there blocked every push of main itself (2026-11-03). main's run is cached per commit, GPU, window and perf.mjs, so it is paid once per main.
//   node tools/gpu/perf-gate.mjs
//   PERF_GATE_BASE=<ref>        compare against another commit (default origin/main)
//   PERF_GATE_TOLERANCE=0.1     the share a metric may grow before it blocks
//   PERF_GATE_ABSOLUTE=1        also block on the absolute targets (the old gate)
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir, loadavg } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { bestOf, compare, failuresOf, worstOf } from './compare.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)
const SOFTWARE_RENDERERS = /swiftshader|llvmpipe|softpipe|software|unknown/i
const SYSTEM_CHROME = '/usr/bin/google-chrome-stable'
const TOLERANCE = Number(process.env.PERF_GATE_TOLERANCE ?? 0.1)
/** @typedef {import('./compare.mjs').Report} Report @typedef {import('./compare.mjs').Phase} Phase */
const VIEWPORT = process.env.PERF_VIEWPORT ?? '1600x900'

/** @param {string} reason @returns {never} */
const skip = (reason) => {
  console.log(`pre-push: perf skipped: ${reason}`)
  process.exit(0)
}

if (process.env.PRE_PUSH_PERF === '0') skip('PRE_PUSH_PERF=0')

// playwright-core comes with the workspace (a dependency of the test tools) inside pnpm's store, not at the top of node_modules
const storeModules = (() => {
  const store = join(root, 'node_modules/.pnpm')
  const entry = existsSync(store) ? readdirSync(store).find((name) => name.startsWith('playwright-core@')) : undefined
  return entry ? join(store, entry, 'node_modules') : undefined
})()
const loadPlaywright = () => {
  for (const id of ['playwright', 'playwright-core', ...(storeModules ? [join(storeModules, 'playwright-core')] : [])]) {
    try {
      return require(id)
    } catch {
      /* try the next one */
    }
  }
  return null
}
const playwright = loadPlaywright()
if (!playwright) skip('playwright not found (set NODE_PATH)')

const hasNvidia = spawnSync('nvidia-smi', ['-L'], { stdio: 'ignore' }).status === 0
// a laptop's discrete card draws only when the process asks for it (PRIME offload)
const gpuEnv = hasNvidia ? { __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia', __VK_LAYER_NV_optimus: 'NVIDIA_only' } : {}
const chrome = process.env.PERF_CHROME ?? (existsSync(SYSTEM_CHROME) ? SYSTEM_CHROME : undefined)
Object.assign(process.env, gpuEnv)

const browser = await playwright.chromium.launch({
  args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu', '--no-sandbox'],
  ...(chrome ? { executablePath: chrome } : {}),
})
const renderer = await (await browser.newPage()).evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2')
  const info = gl?.getExtension('WEBGL_debug_renderer_info')
  return info ? String(gl?.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown'
})
await browser.close()
if (SOFTWARE_RENDERERS.test(renderer)) skip(`no GPU (WebGL draws on ${renderer})`)

const tier = /nvidia|radeon|amd/i.test(renderer) && !/intel/i.test(renderer) ? 'discrete' : 'integrated'
console.log(`pre-push: perf on ${renderer} (${tier}), window ${VIEWPORT}`)

/** @param {string[]} args @param {string} [cwd] */
const git = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
const baseRef = process.env.PERF_GATE_BASE ?? 'origin/main'
const baseSha = (() => {
  try {
    return git(['rev-parse', `${baseRef}^{commit}`])
  } catch {
    return ''
  }
})()
const sameTree = baseSha !== '' && git(['rev-parse', 'HEAD^{tree}']) === git(['rev-parse', `${baseSha}^{tree}`])

const cacheDir = join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'adatechnology-game-kit', 'perf')
mkdirSync(cacheDir, { recursive: true })
const harness = createHash('sha1').update(readFileSync(join(root, 'examples/test-room/perf.mjs'))).digest('hex').slice(0, 10)
const slug = createHash('sha1').update(`${renderer}|${VIEWPORT}|${tier}`).digest('hex').slice(0, 10)
const baseReport = baseSha ? join(cacheDir, `${baseSha.slice(0, 12)}-${slug}-${harness}.json`) : ''

// the budgets hold for a quiet machine: other work on the CPU reads as a slow frame
const QUIET_LOAD = 4
const WAIT_FOR_QUIET_MS = 10 * 60 * 1000
const waitForQuiet = async () => {
  const until = Date.now() + WAIT_FOR_QUIET_MS
  while (loadavg()[0] >= QUIET_LOAD && Date.now() < until) {
    console.log(`pre-push: waiting for a quiet machine (load ${loadavg()[0].toFixed(1)}, under ${QUIET_LOAD} wanted)`)
    await new Promise((done) => setTimeout(done, 30000))
  }
  if (loadavg()[0] >= QUIET_LOAD) console.log(`pre-push: the machine is still busy (load ${loadavg()[0].toFixed(1)}): the frame times below read slower than a player sees`)
}

/**
 * Runs perf.mjs (this checkout's harness) on the page of `pageRoot`, and returns its report. The harness is the same for both sides, so only the page differs.
 * @param {string} pageRoot @param {string} out @param {string} label @returns {Promise<Report>}
 */
const measure = async (pageRoot, out, label) => {
  await waitForQuiet()
  console.log(`pre-push: measuring ${label}`)
  const started = Date.now()
  // a report left by an earlier run must never stand in for this one
  rmSync(out, { force: true })
  const run = spawnSync(process.execPath, [join(root, 'examples/test-room/perf.mjs')], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PERF_MODE: 'gpu',
      PERF_TIER: tier,
      PERF_TARGETS: 'report',
      PERF_VIEWPORT: VIEWPORT,
      PERF_PAGE: join(pageRoot, 'examples/test-room/dist/test-room.html'),
      PERF_OUT: out,
      ...(process.env.DISPLAY ? { PERF_HEADED: '1' } : {}),
      ...(chrome ? { PERF_CHROME: chrome } : {}),
      ...(storeModules ? { NODE_PATH: [process.env.NODE_PATH, storeModules].filter(Boolean).join(':') } : {}),
    },
  })
  console.log(`pre-push: ${label} took ${((Date.now() - started) / 60000).toFixed(1)} min`)
  // perf.mjs exits 1 on a hard failure and still writes its report; with no report (a crash, a closed browser) the run did not happen
  if (!existsSync(out)) throw new Error(`perf.mjs wrote no report for ${label} (exit ${run.status ?? run.signal}): the run did not finish`)
  return JSON.parse(readFileSync(out, 'utf8'))
}

/** A worktree of the base commit, kept between pushes (pnpm links its packages from the store, so a second install is quick), built in place. */
const buildBase = () => {
  const tree = join(cacheDir, 'base-worktree')
  if (!existsSync(join(tree, '.git'))) git(['worktree', 'add', '--force', '--detach', tree, baseSha])
  else git(['checkout', '--force', '--detach', baseSha], tree)
  /** @param {string} command @param {string[]} args */
  const run = (command, args) => execFileSync(command, args, { cwd: tree, stdio: ['ignore', 'ignore', 'inherit'] })
  console.log(`pre-push: building ${baseRef} (${baseSha.slice(0, 8)}) in ${tree}`)
  run('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'])
  run('pnpm', ['-s', 'build'])
  run(process.execPath, ['examples/test-room/build.mjs'])
  return tree
}

execFileSync(process.execPath, [join(root, 'examples/test-room/build.mjs')], { stdio: 'inherit' })
const branchOut = join(root, 'examples/test-room/dist/perf.json')
let branch = await measure(root, branchOut, 'this branch')

/** @type {Report | undefined} */
let base
if (!baseSha) console.log(`pre-push: ${baseRef} not found: no comparison, only the targets`)
else if (sameTree) {
  console.log(`pre-push: this tree is ${baseRef}: its run becomes the reference of this machine`)
  writeFileSync(baseReport, JSON.stringify(branch))
} else if (existsSync(baseReport)) {
  console.log(`pre-push: ${baseRef} (${baseSha.slice(0, 8)}) measured before on this machine (${baseReport})`)
  base = JSON.parse(readFileSync(baseReport, 'utf8'))
} else {
  const tree = buildBase()
  base = await measure(tree, baseReport, `${baseRef} (${baseSha.slice(0, 8)})`)
}

let regressions = base ? compare(base, branch, TOLERANCE) : []
if (base && regressions.length > 0) {
  // one more run of each side before blocking: one frame of the GPU clock dropping is not a regression
  console.log(`pre-push: ${regressions.length} metric(s) over ${Math.round(TOLERANCE * 100)}% worse: measuring both sides again`)
  branch = bestOf(branch, await measure(root, join(cacheDir, 'branch-again.json'), 'this branch again'))
  const tree = existsSync(join(cacheDir, 'base-worktree', '.git')) ? join(cacheDir, 'base-worktree') : buildBase()
  // the better run of the branch against the worse run of main: it blocks only when every run of the branch is worse than every run of main
  base = worstOf(base, await measure(tree, join(cacheDir, 'base-again.json'), `${baseRef} again`))
  regressions = compare(base, branch, TOLERANCE)
}

const failures = failuresOf(branch.failures ?? [])
const hardFailures = failures.filter((failure) => failure.kind === 'hard')
const targets = failures.filter((failure) => failure.kind === 'target')
const baseTargets = base ? failuresOf(base.failures ?? []).filter((failure) => failure.kind === 'target').length : undefined

console.log('')
console.log(`pre-push: perf report (${renderer}, window ${VIEWPORT}${base ? `, against ${baseRef} ${baseSha.slice(0, 8)} on this machine` : ''})`)
if (base) {
  const rows = branch.phases.map((phase) => {
    const before = base?.phases.find((candidate) => candidate.name === phase.name)
    /** @param {keyof Phase} key */
    const cell = (key) => (before ? `${before[key]} -> ${phase[key]}` : `${phase[key]}`)
    return `  ${phase.name.padEnd(18)} p99 ${cell('p99').padEnd(14)} worst ${cell('max').padEnd(16)} long task ${cell('worstLongTask').padEnd(12)} draws ${cell('drawsPerFrame')}`
  })
  for (const row of rows) console.log(row)
}
for (const target of targets) console.log(`TARGET  ${target.text}`)
console.log(`pre-push: ${targets.length} absolute target(s) missed${baseTargets === undefined ? '' : ` (${baseRef}: ${baseTargets})`}: the goal, not the gate${process.env.PERF_GATE_ABSOLUTE === '1' ? ' (PERF_GATE_ABSOLUTE=1: blocking)' : ''}`)
for (const failure of hardFailures) console.log(`FAIL  ${failure.text}`)
for (const { phase, metric, base: was, branch: now } of regressions) console.log(`FAIL  ${phase}: ${metric} ${was} -> ${now} (more than ${Math.round(TOLERANCE * 100)}% worse than ${baseRef} on this machine)`)

const blocked = hardFailures.length > 0 || regressions.length > 0 || (process.env.PERF_GATE_ABSOLUTE === '1' && targets.length > 0)
console.log(blocked ? 'pre-push: perf blocks the push' : 'pre-push: perf passes')
process.exit(blocked ? 1 : 0)
