// usage: node hang-stack.mjs <query> <kind> <seconds>: runs the probe and, after <seconds>, pauses the page's JS and prints the call stack (finds where a frame spends its time). By hand.
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const { chromium } = createRequire(import.meta.url)('/home/miyazaki/.cache/gk-playwright/node_modules/playwright')
const [query = '', kind = 'blast', seconds = '40'] = process.argv.slice(2)
const ruler = execFileSync(process.execPath, [join(here, 'ruler-bundle.mjs')], { encoding: 'utf8' })
const source = readFileSync(join(here, 'room.js'), 'utf8')
const browser = await chromium.launch({ args: ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu', '--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.on('console', (m) => { if (m.text().startsWith('probe ')) console.log(m.text()) })
await page.goto(`${pathToFileURL(join(here, '../../../../examples/test-room/dist/test-room.html')).href}?area=floorplan${query}`, { timeout: 180000 })
await page.waitForFunction(() => window.__testRoom, null, { timeout: 600000 })
page.evaluate(`(async () => { const EnergyRuler = ${ruler}; return await ${source.replaceAll('__KIND__', kind)} })()`).catch(() => {})
await new Promise((f) => setTimeout(f, Number(seconds) * 1000))
const cdp = await page.context().newCDPSession(page)
await cdp.send('Debugger.enable')
const paused = new Promise((f) => cdp.on('Debugger.paused', f))
await cdp.send('Debugger.pause')
const ev = await paused
for (const f of ev.callFrames.slice(0, 25)) console.log(f.functionName || '(anon)', f.url.slice(-40), f.location.lineNumber + ':' + f.location.columnNumber)
process.exit(0)
