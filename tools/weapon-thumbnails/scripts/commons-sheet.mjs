// Contact sheet of the candidates found by commons-search.mjs, to choose by eye which one is the side profile of THAT weapon.
// Usage: node scripts/commons-sheet.mjs <work folder> <out.png> <first> <count> [titles.json: only the candidates with these titles]
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

import { sanitizeSvg, sizedSvg } from './commons-sanitize.mjs'

const require = createRequire(import.meta.url)
const { chromium } = (() => { try { return require('playwright') } catch { return require('playwright-core') } })()
const [work, out, first = '0', count = '12', only] = process.argv.slice(2)
const wanted = only ? new Set(JSON.parse(readFileSync(only, 'utf8'))) : undefined
const cells = []
for (const file of readdirSync(join(work, 'search')).sort()) {
  const search = JSON.parse(readFileSync(join(work, 'search', file), 'utf8'))
  search.candidates.filter((entry) => entry.ok && entry.raw && (!wanted || wanted.has(entry.title))).forEach((entry, index) => {
    const sized = sizedSvg(sanitizeSvg(readFileSync(join(work, entry.raw), 'utf8')), 600)
    if (sized) cells.push(`<figure><img src="data:image/svg+xml;base64,${Buffer.from(sized.svg).toString('base64')}"><figcaption><b>${search.id}</b> #${index}<br>${entry.title.replace(/[<>&]/g, '')}<br>${entry.license}</figcaption></figure>`)
  })
}
const slice = cells.slice(Number(first), Number(first) + Number(count))
console.log(`${cells.length} candidates in total, ${slice.length} on this sheet`)
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 1500, height: 900 } })
await context.route('**/*', (route) => (/^(data|about):/.test(route.request().url()) ? route.continue() : route.abort()))
const page = await context.newPage()
await page.setContent(`<style>body{margin:0;font:11px sans-serif;background:#fff;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:6px}figure{margin:0;border:1px solid #ccc}img{width:100%;height:170px;object-fit:contain;background:#f4f4f4}figcaption{padding:2px 4px;height:44px;overflow:hidden}</style>${slice.join('')}`)
await page.screenshot({ path: out, fullPage: true })
await browser.close()
