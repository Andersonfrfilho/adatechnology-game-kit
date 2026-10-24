// Step 2 of the thumbnails, search: for each subject, looks for freely licensed SVGs on Wikimedia Commons (at most 3 searches of the 10 allowed, 0.55 s apart, a descriptive User-Agent),
// writes search/<id>.json after every weapon and downloads the licensed candidates raw into raw/<id>/ of the WORK folder (scratch, never the repo). Resumable.
// Usage: node scripts/commons-search.mjs <work folder> [weapon id...]
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SUBJECTS } from './commons-subjects.mjs'
const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const BASE = (() => {
  const given = process.argv[2]
  if (!given || given.startsWith('-')) throw new Error('usage: node scripts/commons-search.mjs <work folder> [weapon id...]')
  const base = resolve(given)
  const inside = relative(repository, base)
  if (!inside.startsWith('..') && !isAbsolute(inside)) throw new Error(`the work folder must be scratch space outside the repository, got ${base}`)
  return base
})()
const UA = 'adatechnology-game-kit-thumbnail-research/1.0 (https://github.com/Andersonfrfilho/adatechnology-game-kit) node-fetch'
const API = 'https://commons.wikimedia.org/w/api.php'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const ALLOWED = /^(public domain|pd[- ]|cc0|cc[- ]by[- ]sa|cc[- ]by[- ]\d|cc[- ]by \d)/i
const NOT_ALLOWED = /\b(nc|nd)\b/i
let last = 0
async function get(url, asText = false) {
  const delta = Date.now() - last
  if (delta < 550) await wait(550 - delta)
  last = Date.now()
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip' } })
    if (res.status === 429 || res.status >= 500) { await wait(4000 * (attempt + 1)); continue }
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    return asText ? res.text() : res.json()
  }
  throw new Error(`gave up ${url}`)
}
const only = process.argv.slice(3)
for (const [id, [query, ...keys]] of Object.entries(SUBJECTS)) {
  if (only.length && !only.includes(id)) continue
  const out = join(BASE, 'search', `${id}.json`)
  if (existsSync(out)) continue
  const variants = [`${query} filetype:drawing`, `${query} silhouette filetype:drawing`, `${query} side view svg`]
  const titles = new Map()
  let searches = 0
  for (const q of variants) {
    if (titles.size >= 4 || searches >= 10) break
    searches++
    const url = `${API}?action=query&format=json&list=search&srnamespace=6&srlimit=25&srsearch=${encodeURIComponent(q)}`
    const data = await get(url)
    for (const hit of data.query?.search ?? []) {
      const title = hit.title
      if (!/\.svg$/i.test(title)) continue
      if (keys.some((k) => norm(title).includes(k))) titles.set(title, true)
    }
  }
  const candidates = []
  if (titles.size) {
    const list = [...titles.keys()].slice(0, 8)
    const info = await get(`${API}?action=query&format=json&prop=imageinfo&iiprop=url|mime|size|extmetadata&titles=${encodeURIComponent(list.join('|'))}`)
    for (const page of Object.values(info.query?.pages ?? {})) {
      const ii = page.imageinfo?.[0]
      if (!ii) continue
      const meta = ii.extmetadata ?? {}
      const v = (k) => (meta[k]?.value ?? '').replace(/<[^>]+>/g, '').trim()
      const license = v('LicenseShortName')
      candidates.push({
        title: page.title, mime: ii.mime, originalUrl: ii.url, page: ii.descriptionurl, width: ii.width, height: ii.height,
        author: v('Artist'), license, licenseUrl: v('LicenseUrl'), credit: v('Credit'), creditHtml: meta.Credit?.value ?? '',
        ok: ii.mime === 'image/svg+xml' && ALLOWED.test(license) && !NOT_ALLOWED.test(license),
      })
    }
    for (const [i, c] of candidates.filter((c) => c.ok).slice(0, 3).entries()) {
      const dir = join(BASE, 'raw', id)
      mkdirSync(dir, { recursive: true })
      const text = await get(c.originalUrl, true)
      writeFileSync(join(dir, `${i}.svg`), text)
      c.raw = `raw/${id}/${i}.svg`
    }
  }
  writeFileSync(out, JSON.stringify({ id, searches, candidates }, null, 1))
  console.log(id, searches, candidates.map((c) => `${c.ok ? '+' : '-'}${c.title}`).join(' ; '))
}
