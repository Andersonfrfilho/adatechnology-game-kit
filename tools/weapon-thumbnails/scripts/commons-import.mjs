// Step 2 of the thumbnails, import: for each weapon in <work>/picks.json (weapon id -> { raw, title, ... } chosen after looking at the candidates), sanitizes the raw download,
// draws it, reduces it to an outline with the tool's own tracer and writes assets/weapon-svg/commons/<id>.svg plus commons-sources.json (author, licence, links).
// Only the traced outline is published, never the downloaded markup. Usage: node scripts/commons-import.mjs <work folder>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { sanitizeSvg } from './commons-sanitize.mjs'
import { openRenderer } from './commons-render.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const folder = join(here, '../../../packages/game-weapons-three/assets/weapon-svg')
const { bitmapSilhouetteSvg, MAX_SVG_BYTES } = await import(pathToFileURL(join(here, '../dist/index.js')).href)
const work = process.argv[2]
if (!work) throw new Error('usage: node scripts/commons-import.mjs <work folder>')
const picks = JSON.parse(readFileSync(join(work, 'picks.json'), 'utf8'))
mkdirSync(join(folder, 'commons'), { recursive: true })
mkdirSync(join(work, 'clean'), { recursive: true })
const sourcesPath = join(folder, 'commons-sources.json')
let sources = {}
try {
  sources = JSON.parse(readFileSync(sourcesPath, 'utf8'))
} catch {}
const renderer = await openRenderer()
for (const [id, pick] of Object.entries(picks)) {
  const search = JSON.parse(readFileSync(join(work, 'search', `${id}.json`), 'utf8'))
  const candidate = search.candidates.find((entry) => entry.title === pick.title)
  if (!candidate?.raw || !candidate.ok) {
    console.log(`skip ${id}: ${pick.title} is not a licensed, downloaded candidate`)
    continue
  }
  const clean = sanitizeSvg(readFileSync(join(work, candidate.raw), 'utf8'))
  writeFileSync(join(work, 'clean', `${id}.svg`), clean)
  const bitmap = await renderer.tones(clean)
  const svg = bitmap && bitmapSilhouetteSvg(bitmap)
  if (!svg || Buffer.byteLength(svg) > MAX_SVG_BYTES) {
    console.log(`skip ${id}: ${svg ? `${Buffer.byteLength(svg)} bytes` : 'nothing drawn'}`)
    continue
  }
  writeFileSync(join(folder, 'commons', `${id}.svg`), svg)
  sources[id] = { title: candidate.title, author: candidate.author || 'unknown', license: candidate.license, licenseUrl: candidate.licenseUrl || candidate.page, page: candidate.page, originalUrl: candidate.originalUrl.split('?')[0] }
  writeFileSync(sourcesPath, `${JSON.stringify(Object.fromEntries(Object.entries(sources).sort(([a], [b]) => (a < b ? -1 : 1))), null, 1)}\n`)
  console.log(`ok ${id} <- ${candidate.title} (${candidate.license}) ${Buffer.byteLength(svg)} bytes`)
}
await renderer.close()
