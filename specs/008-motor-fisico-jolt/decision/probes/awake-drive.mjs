// usage: node awake-drive.mjs <label> <query> <kind> <fromSeconds>  — one round, prints the JSON of awake.js (T3.8h).
import { createRequire } from 'node:module'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT ?? '/home/miyazaki/.cache/gk-playwright/node_modules/playwright')
const [label, query = '', kind = 'hammer', from = '2.5'] = process.argv.slice(2)
const out = process.env.OUT ?? join(here, 'out')
mkdirSync(out, { recursive: true })
const source = readFileSync(join(here, 'awake.js'), 'utf8').replaceAll('__KIND__', kind).replaceAll('__FROM__', from)
const browser = await chromium.launch({ args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`${pathToFileURL(join(here, '../../../../examples/test-room/dist/test-room.html')).href}?area=floorplan${query}`, { timeout: 180000 })
await page.waitForFunction(() => window.__testRoom, null, { timeout: 600000 })
const result = await page.evaluate(source)
writeFileSync(join(out, `${label}.json`), JSON.stringify({ errors, ...result }))
console.log(JSON.stringify({ errors, lastAwake: result.lastAwake, names: result.names, frames: result.frames.length }))
await browser.close()
