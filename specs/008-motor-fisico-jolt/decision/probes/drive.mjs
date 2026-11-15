// usage: node drive.mjs <label> <query> [rounds] [kinds]  (T3.8, by hand, never in CI). Opens the built room (examples/test-room/dist/test-room.html) once per round in a fresh page,
// injects the ruler of T3.4 and room.js, and prints one JSON line per round. query: '' (own solver), '&solver=jolt', '&solver=jolt&blastDebris=1'.
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT ?? '/home/miyazaki/.cache/gk-playwright/node_modules/playwright')
const [label, query = '', rounds = '5', kinds = 'blast,hammer'] = process.argv.slice(2)
const page_ = join(here, '../../../../examples/test-room/dist/test-room.html')
const out = process.env.OUT ?? join(here, 'out')
mkdirSync(out, { recursive: true })
const ruler = execFileSync(process.execPath, [join(here, 'ruler-bundle.mjs')], { encoding: 'utf8' })
const source = readFileSync(join(here, 'room.js'), 'utf8')
const browser = await chromium.launch({ args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--no-sandbox'] })
for (const kind of kinds.split(',')) for (let round = 1; round <= Number(rounds); round++) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${pathToFileURL(page_).href}?area=floorplan${query}`, { timeout: 180000 })
  await page.waitForFunction(() => window.__testRoom, null, { timeout: 600000 })
  const started = Date.now()
  const expression = `(async () => { const EnergyRuler = ${ruler}; return await ${source.replaceAll('__KIND__', kind)} })()`
  const result = await page.evaluate(expression)
  const gpu = await page.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2'); const i = gl.getExtension('WEBGL_debug_renderer_info'); return i ? gl.getParameter(i.UNMASKED_RENDERER_WEBGL) : 'unknown' })
  const line = { label, kind, round, seconds: (Date.now() - started) / 1000, gpu, errors, ...result }
  writeFileSync(join(out, `${label}.${kind}.${round}.json`), JSON.stringify(line, null, 1))
  if (process.env.SHOT && round === 1) await page.screenshot({ path: join(out, `${label}.${kind}.png`) })
  console.log(JSON.stringify(line))
  await page.close()
}
await browser.close()
