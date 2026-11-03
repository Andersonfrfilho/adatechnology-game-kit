#!/usr/bin/env node
// The frame budgets of examples/test-room/perf.mjs on this machine's own GPU, before a push (.githooks/pre-push). CI has no GPU (it checks the counts
// and the cost per piece), so the frame times are checked here. A machine without a GPU, where WebGL falls back to
// software (SwiftShader, llvmpipe), skips with a message; PRE_PUSH_PERF=0 skips on purpose.
//   node tools/gpu/perf-gate.mjs
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { loadavg } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)
const SOFTWARE_RENDERERS = /swiftshader|llvmpipe|softpipe|software|unknown/i
const SYSTEM_CHROME = '/usr/bin/google-chrome-stable'

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
  return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown'
})
await browser.close()
if (SOFTWARE_RENDERERS.test(renderer)) skip(`no GPU (WebGL draws on ${renderer})`)

// the budgets hold for a quiet machine: other work on the CPU reads as a slow frame
const QUIET_LOAD = 4
const WAIT_FOR_QUIET_MS = 10 * 60 * 1000
const until = Date.now() + WAIT_FOR_QUIET_MS
while (loadavg()[0] >= QUIET_LOAD && Date.now() < until) {
  console.log(`pre-push: waiting for a quiet machine (load ${loadavg()[0].toFixed(1)}, under ${QUIET_LOAD} wanted)`)
  await new Promise((done) => setTimeout(done, 30000))
}
if (loadavg()[0] >= QUIET_LOAD) console.log(`pre-push: the machine is still busy (load ${loadavg()[0].toFixed(1)}): the frame times below read slower than a player sees`)
const tier = /nvidia|radeon|amd/i.test(renderer) && !/intel/i.test(renderer) ? 'discrete' : 'integrated'
console.log(`pre-push: perf on ${renderer} (${tier})`)
const started = Date.now()
execFileSync(process.execPath, [join(root, 'examples/test-room/build.mjs')], { stdio: 'inherit' })
const run = spawnSync(process.execPath, [join(root, 'examples/test-room/perf.mjs')], {
  stdio: 'inherit',
  env: { ...process.env, PERF_MODE: 'gpu', PERF_TIER: tier, ...(process.env.DISPLAY ? { PERF_HEADED: '1' } : {}), ...(chrome ? { PERF_CHROME: chrome } : {}), ...(storeModules ? { NODE_PATH: [process.env.NODE_PATH, storeModules].filter(Boolean).join(':') } : {}) },
})
console.log(`pre-push: perf took ${((Date.now() - started) / 60000).toFixed(1)} min`)
process.exit(run.status ?? 1)
