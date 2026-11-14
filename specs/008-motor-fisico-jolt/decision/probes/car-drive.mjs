// usage: node car-drive.mjs <query> <model>: opens the room, injects car.js (model swapped) and prints one JSON line. By hand (T3.8), never in CI.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? '/home/miyazaki/.cache/gk-playwright/node_modules/playwright')
const [query = '', model = 'sedan'] = process.argv.slice(2)
const browser = await chromium.launch({ args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.on('pageerror', (e) => console.error(e.message))
await page.goto(`${pathToFileURL(join(here, '../../../../examples/test-room/dist/test-room.html')).href}?x=1${query}`, { timeout: 180000 })
await page.waitForFunction(() => window.__testRoom, null, { timeout: 600000 })
const result = await page.evaluate(readFileSync(join(here, 'car.js'), 'utf8').replaceAll('__MODEL__', model))
console.log(JSON.stringify({ query, ...result }))
await browser.close()
