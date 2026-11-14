// usage: node profile-drive.mjs <label> <query> <kind> <dt>   (T3.8b, by hand, never in CI). One fresh page; prints the per-stage cost JSON of profile.js.
import { createRequire } from 'node:module'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT ?? '/home/miyazaki/.cache/gk-playwright/node_modules/playwright')
const [label, query = '', kind = 'blast', dt = '0.05'] = process.argv.slice(2)
const out = process.env.OUT ?? join(here, 'out')
mkdirSync(out, { recursive: true })
const source = readFileSync(join(here, 'profile.js'), 'utf8').replaceAll('__KIND__', kind).replaceAll('__DT__', dt)
const browser = await chromium.launch({ args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.error('pageerror', e.message))
await page.goto(`${pathToFileURL(join(here, '../../../../examples/test-room/dist/test-room.html')).href}?area=floorplan${query}`, { timeout: 180000 })
await page.waitForFunction(() => window.__testRoom, null, { timeout: 600000 })
const result = await page.evaluate(`(async () => await ${source})()`)
writeFileSync(join(out, `${label}.${kind}.${dt}.json`), JSON.stringify(result, null, 1))
console.log(JSON.stringify(result))
await browser.close()
