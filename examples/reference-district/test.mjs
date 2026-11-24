// Opens the district page in a browser, one print for each scenario in each camera (third person and first person) in shots/, and a top-down plan sheet that is only a debug
// print (plan-sheet-debug.png: the game has no view from above). The page needs a GPU: this never runs on CI (CLAUDE.md section 9), `pnpm check:district` runs it by hand.
//   DISTRICT_ONLY=caos:first runs one scenario in one camera; DISTRICT_SOFTWARE_GL=1 uses the software renderer (slow); DISTRICT_SETTLE_MS is the real time each page runs before its print (default 4000).
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, 'dist')
if (!existsSync(join(dist, 'district.html'))) throw new Error('dist/district.html missing: run node build.mjs')

const require = createRequire(import.meta.url)
const playwright = ['playwright', 'playwright-core'].map((id) => { try { return require(id) } catch { return null } }).find(Boolean)
if (!playwright) {
  console.log('skipped the browser check (no playwright)')
  process.exit(0)
}

/** @type {Record<string, string>} */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ogg': 'audio/ogg', '.wasm': 'application/wasm' }
const server = createServer((request, response) => {
  const path = normalize(join(dist, decodeURIComponent((request.url ?? '/').split('?')[0] ?? '/')))
  if (!path.startsWith(dist) || !existsSync(path) || !statSync(path).isFile()) {
    response.writeHead(404).end()
    return
  }
  response.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' })
  createReadStream(path).pipe(response)
})
await new Promise((done) => server.listen(0, '127.0.0.1', () => done(undefined)))
const address = server.address()
const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/district.html`

const SCENARIOS = ['tipico', 'pior', 'caos']
const CAMERAS = [{ query: 'third', name: 'third' }, { query: 'first', name: 'first' }]
// the spec's counts per scenario (data/recorte-1.scripts.json), what the page must have made
/** @type {Record<string, number>} */
const ZOMBIES = { tipico: 500, pior: 2000, caos: 500 }
const only = process.env.DISTRICT_ONLY ? process.env.DISTRICT_ONLY.split(':') : null
const settleMs = Number(process.env.DISTRICT_SETTLE_MS ?? 4000)
const shots = join(here, 'shots')
mkdirSync(shots, { recursive: true })

const args = process.env.DISTRICT_SOFTWARE_GL === '1' ? ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] : ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu', '--no-sandbox']
const browser = await playwright.chromium.launch({ args })
let failed = 0
/** @param {string} name @param {unknown} ok @param {unknown} [detail] */
const check = (name, ok, detail) => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`)
}

/** @param {string} query */
async function open(query) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await context.newPage()
  /** @type {string[]} */
  const errors = []
  page.on('console', (/** @type {import('playwright-core').ConsoleMessage} */ message) => message.type() === 'error' && errors.push(message.text()))
  page.on('response', (/** @type {import('playwright-core').Response} */ response) => response.status() >= 400 && errors.push(`${response.status()} ${response.url()}`))
  page.on('pageerror', (/** @type {Error} */ error) => errors.push(`pageerror: ${error.message}`))
  await page.goto(`${base}?${query}`, { timeout: 120000 })
  await page.waitForFunction(() => window.__district || window.__districtError, null, { timeout: 300000, polling: 500 })
  return { context, page, errors }
}

/** Frames between two samples of the lights, and how many samples: about two seconds of the lamps. */
const FLICKER_SAMPLE_MS = 50
const FLICKER_SAMPLES = 40
const sameLight = (/** @type {{ x: number, z: number }} */ a, /** @type {{ x: number, z: number }} */ b) => Math.hypot(a.x - b.x, a.z - b.z) < 0.5

/**
 * The night street: the host lights its nearest lamps, some lamps fail. Samples the lit point lights over two seconds, finds one whose brightness jumps (a failing lamp), stands in front of it and
 * prints it once bright and once dim (pior-flicker-on.png, pior-flicker-off.png). @param {import('playwright-core').Page} page
 */
async function checkFlicker(page) {
  /** @type {Array<Array<{ x: number, y: number, z: number, intensity: number }>>} */
  const samples = []
  for (let index = 0; index < FLICKER_SAMPLES; index++) {
    samples.push(await page.evaluate(() => window.__district?.pointLights() ?? []))
    await page.waitForTimeout(FLICKER_SAMPLE_MS)
  }
  const lit = Math.max(...samples.map((sample) => sample.length))
  const all = samples.flat()
  const flickering = all
    .filter((light, index) => all.findIndex((other) => sameLight(light, other)) === index)
    .map((light) => {
      const levels = all.filter((other) => sameLight(light, other)).map((other) => other.intensity)
      return { ...light, peak: Math.max(...levels), low: Math.min(...levels) }
    })
    .filter((light) => light.peak > 2 * light.low)
  check('pior third: street lamps lit at night (host budget slots)', lit >= 4, { lit })
  check('pior third: some lamp flickers', flickering.length > 0, { flickering: flickering.map((light) => [Math.round(light.x), Math.round(light.z)]) })
  const target = flickering.sort((a, b) => Math.hypot(a.x - 46, a.z) - Math.hypot(b.x - 46, b.z))[0]
  if (!target) return
  const from = { x: target.x - 10, z: target.z > 0 ? target.z - 6 : target.z + 6 }
  await page.evaluate(({ from, target }) => window.__district?.place({ x: from.x, z: from.z, yaw: Math.atan2(-(target.x - from.x), -(target.z - from.z)), pitch: 0.2 }), { from, target })
  await page.waitForTimeout(2500)
  /** @type {Set<string>} */
  const taken = new Set()
  for (let index = 0; index < 200 && taken.size < 2; index++) {
    const now = (await page.evaluate(() => window.__district?.pointLights() ?? [])).find((light) => sameLight(light, target))
    const state = now && now.intensity > 0.6 * target.peak ? 'on' : 'off'
    if (!taken.has(state)) {
      await page.screenshot({ path: join(shots, `pior-flicker-${state}.png`) })
      taken.add(state)
    }
    await page.waitForTimeout(15)
  }
  check('pior third: prints of a failing lamp bright and dim', taken.size === 2, { lamp: [Math.round(target.x), Math.round(target.z)], taken: [...taken] })
}

for (const scenario of SCENARIOS) {
  for (const camera of CAMERAS) {
    if (only && (only[0] !== scenario || only[1] !== camera.name)) continue
    const label = `${scenario} ${camera.name}`
    const { context, page, errors } = await open(`cena=${scenario}&camera=${camera.query}`)
    const failure = await page.evaluate(() => window.__districtError ?? null)
    check(`${label}: the page comes up`, failure === null, failure ?? undefined)
    if (failure === null) {
      await page.waitForTimeout(settleMs)
      const info = await page.evaluate(() => window.__district?.info())
      check(`${label}: the district is there`, info?.houses === 15 && info.missing === 14 && info.zombies === ZOMBIES[scenario] && info.physics === 'jolt', info)
      // the street's walk starts before the first lot (x = 50): the print is taken at the first houses, looking along the street
      if (scenario !== 'caos') {
        await page.evaluate(() => window.__district?.place({ x: 46, z: 0, yaw: -Math.PI / 2 }))
        await page.waitForTimeout(2500)
      }
      await page.screenshot({ path: join(shots, `${scenario}-${camera.name}.png`) })
      if (scenario === 'pior' && camera.name === 'third') await checkFlicker(page)
      if (scenario === 'tipico' && camera.name === 'third') {
        const url = await page.evaluate(() => window.__district?.planSheet() ?? '')
        writeFileSync(join(shots, 'plan-sheet-debug.png'), Buffer.from(url.split(',')[1] ?? '', 'base64'))
      }
    }
    check(`${label}: no console error`, errors.length === 0, errors.slice(0, 5))
    await context.close()
  }
}
await browser.close()
server.close()
if (failed > 0) {
  console.error(`${failed} checks failed`)
  process.exit(1)
}
console.log('ok')
