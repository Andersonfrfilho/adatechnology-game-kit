// Runs the scripts of the district twice each, in fresh pages with no display loop, and compares the hash of the world at the end of every phase (spec 011, R10).
// A hashed run takes more frames than an unhashed one (the hash drains the blast pacer), so the T2.6 gauge must run unhashed.
// Same seed, same script, same step: the hashes must be identical, no hash may be missing, and a blast must change the world (the destruction hash of `grenade` differs from `shoot`, `caos_blast` from `caos_fire`).
// The Hz part of R10 (60, 120 and 144 Hz give the same world) is not run here: the runner never renders, it steps `scheduler.frame(tick, { exact: true })`, so there is no display rate to vary; the scheduler's own
// tests in packages/game-runtime cover that the display rate does not change the fixed steps. Needs a browser; never on CI (CLAUDE.md section 9). Run it under the machine's measure lock:
//   flock ~/.cache/adatechnology-game-kit/perf-measure.lock nice node determinism.mjs      (DISTRICT_ONLY=caos runs one scenario; DISTRICT_RUNS=3 more rounds; DISTRICT_QUERY='&solver=own')
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, 'dist')
if (!existsSync(join(dist, 'district.html'))) throw new Error('dist/district.html missing: run node build.mjs')
const require = createRequire(import.meta.url)
const playwright = ['playwright', 'playwright-core'].map((id) => { try { return require(id) } catch { return null } }).find(Boolean)
if (!playwright) throw new Error('playwright is not installed')

/** @type {Record<string, string>} */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ogg': 'audio/ogg', '.wasm': 'application/wasm' }
const server = createServer((request, response) => {
  const path = normalize(join(dist, decodeURIComponent((request.url ?? '/').split('?')[0] ?? '/')))
  if (!path.startsWith(dist) || !existsSync(path) || !statSync(path).isFile()) return void response.writeHead(404).end()
  response.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' })
  createReadStream(path).pipe(response)
})
await new Promise((done) => server.listen(0, '127.0.0.1', () => done(undefined)))
const address = server.address()
const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/district.html`

const SCENARIOS = process.env.DISTRICT_ONLY ? [process.env.DISTRICT_ONLY] : ['tipico', 'pior', 'caos']
const RUNS = Number(process.env.DISTRICT_RUNS ?? 2)
const extra = process.env.DISTRICT_QUERY ?? ''
const args = ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu', '--no-sandbox']
const browser = await playwright.chromium.launch({ args })

/** One fresh page: no animation frames (the display loop never runs, so what the page did before the run cannot depend on how long it took to load), then the whole script. @param {string} scenario */
async function runOnce(scenario) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage()
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0 })
  /** @type {string[]} */
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${base}?cena=${scenario}&roteiro=1${extra}`, { timeout: 120000 })
  await page.waitForFunction(() => window.__district || window.__districtError, null, { timeout: 300000, polling: 500 })
  const failure = await page.evaluate(() => window.__districtError ?? null)
  if (failure) throw new Error(`${scenario}: the page did not come up: ${failure}`)
  const started = Date.now()
  const result = await page.evaluate(() => window.__district.run(undefined, { hash: true }))
  await page.context().close()
  return { result, seconds: (Date.now() - started) / 1000, errors }
}

let failed = 0
for (const scenario of SCENARIOS) {
  const runs = []
  for (let index = 0; index < RUNS; index++) runs.push(await runOnce(scenario))
  const [first, ...others] = runs
  console.log(`\n${scenario}: script ${first.result.scriptId}, seed ${first.result.seed}, ${first.result.ticks} ticks, ${runs.map((run) => run.seconds.toFixed(0)).join(' s / ')} s`)
  for (const phase of first.result.phases) {
    const same = others.every((other) => JSON.stringify(other.result.phases.find((candidate) => candidate.id === phase.id)?.hash) === JSON.stringify(phase.hash))
    if (!same) failed++
    console.log(`  ${same ? 'SAME' : 'DIFF'}  ${phase.id.padEnd(12)} ${JSON.stringify(phase.hash)}${same ? '' : `\n        other ${JSON.stringify(others.map((other) => other.result.phases.find((candidate) => candidate.id === phase.id)?.hash))}`}`)
  }
  /** @param {string} id */
  const destructionOf = (id) => first.result.phases.find((phase) => phase.id === id)?.hash?.destruction
  for (const phase of first.result.phases) if (!phase.hash || Object.values(phase.hash).some((value) => typeof value !== 'number')) { failed++; console.log(`  FAIL  ${phase.id} has no complete hash`) }
  for (const [after, before] of [['grenade', 'shoot'], ['caos_blast', 'caos_fire']]) {
    if (destructionOf(after) === undefined || destructionOf(before) === undefined) continue
    const changed = destructionOf(after) !== destructionOf(before)
    if (!changed) failed++
    console.log(`  ${changed ? 'OK  ' : 'FAIL'}  destruction hash of ${after} differs from ${before}`)
  }
  for (const blast of first.result.blasts.filter((candidate) => candidate.explosive === 'c4')) {
    const hurt = blast.killsAfter > blast.killsBefore
    if (!hurt) failed++
    console.log(`  ${hurt ? 'OK  ' : 'FAIL'}  the c4 raised the dead count`)
  }
  const sameBlasts = others.every((other) => JSON.stringify(other.result.blasts) === JSON.stringify(first.result.blasts))
  if (!sameBlasts) failed++
  console.log(`  ${sameBlasts ? 'SAME' : 'DIFF'}  blasts across runs`)
  for (const blast of first.result.blasts) console.log(`    blast ${blast.explosive} (event ${blast.eventIndex}) at step ${blast.step}: in reach ${blast.inReach} (lethal ${blast.inLethal}), dead ${blast.killsBefore} -> ${blast.killsAfter}`)
  console.log(`  detonations per event: ${first.result.events.filter((event) => event.detonations !== undefined).map((event) => `${event.kind}@${event.at}=${event.detonations}`).join(' ') || 'none'}`)
  const pending = first.result.events.filter((event) => event.status !== 'done').map((event) => `${event.kind}@${event.at}:${event.status}:${event.limit}(${event.source})`)
  console.log(`  pending: ${pending.join(' ')}`)
  console.log(`  cues: ${first.result.cues.map((cue) => `${cue.mode}@${cue.at}${cue.status === 'pending' ? `:${cue.limit}` : ''}`).join(' ')}`)
  if (runs.some((run) => run.errors.length)) console.log(`  page errors: ${runs.flatMap((run) => run.errors).slice(0, 3).join(' | ')}`)
}
await browser.close()
server.close()
console.log(failed === 0 ? '\nok: identical in every phase' : `\n${failed} phases differ`)
process.exit(failed === 0 ? 0 : 1)
