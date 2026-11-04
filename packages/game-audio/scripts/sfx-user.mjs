// @ts-check
// pnpm --filter @adatechnology/game-audio sfx:user [--from <pasta dos pacotes>] [--out <pasta>] [--picks <arquivo>]
//
// Converts the owner's own sounds (packs whose licence the kit cannot redistribute) into a local folder that never enters git or npm:
//   - reads user-sounds/picks.json (sound id, role, pack, files in the pack);
//   - finds each file under <from>/<pack>/ by the end of its path (default --from ~/sons-candidatos), so the pack may be nested differently;
//   - cuts the trailing silence (some packs pad every take to 8.5 s), then converts like sfx:convert (Ogg Vorbis, 48 kHz, mono, peak −1 dBFS,
//     leading silence cut, loops untouched);
//   - writes <out>/<categoria>/<id>_<nn>.ogg and <out>/manifest.json (default <repo>/.sfx-local/, ignored by git).
// The test room build copies that folder next to the page as sfx-local/, where `loadUserSamples` fetches it. Without it nothing changes.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { convert } from './sfx-convert.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const packageDir = resolve(here, '..')
const root = resolve(packageDir, '../..')

/** @typedef {{ id: string, role: 'primary' | 'fallback', category: string, label: string, pack: string, files: string[], score: number, loop?: boolean }} Pick */
/** @typedef {{ version: 1, author: string, license: string, picks: Pick[] }} Picks */

/** @param {string} name */
const arg = (name) => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

/**
 * Every file under a folder, as paths relative to it with `/`.
 * @param {string} dir
 * @returns {string[]}
 */
const walk = (dir) => {
  /** @type {string[]} */
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...walk(path).map((inner) => `${name}/${inner}`))
    else out.push(name)
  }
  return out
}

/**
 * The folder of a pack under `from`: its own name, or the name without the archive extension.
 * @param {string} from
 * @param {string} pack
 */
const packDir = (from, pack) => {
  for (const name of [pack, pack.replace(/\.(zip|rar|7z)$/i, '')]) {
    const dir = join(from, name)
    if (existsSync(dir) && statSync(dir).isDirectory()) return dir
  }
  return null
}

/**
 * A copy of the file without its trailing silence (a wav in a temp folder).
 * @param {string} input
 * @param {string} temp
 */
const trimTail = (input, temp) => {
  const output = join(temp, `${Math.random().toString(36).slice(2)}.wav`)
  execFileSync('ffmpeg', ['-hide_banner', '-nostats', '-loglevel', 'error', '-y', '-i', input, '-af', 'areverse,silenceremove=start_periods=1:start_threshold=-60dB:detection=peak,areverse', output])
  return output
}

function main() {
  const from = resolve(arg('--from') ?? join(homedir(), 'sons-candidatos'))
  const out = resolve(arg('--out') ?? join(root, '.sfx-local'))
  /** @type {Picks} */
  const picks = JSON.parse(readFileSync(resolve(arg('--picks') ?? join(packageDir, 'user-sounds/picks.json')), 'utf8'))
  if (!existsSync(from)) {
    console.error(`pasta dos pacotes não encontrada: ${from} (use --from <pasta>)`)
    process.exit(1)
  }
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  const temp = mkdtempSync(join(tmpdir(), 'sfx-user-'))
  /** @type {Map<string, string[]>} */
  const listings = new Map()
  /** @type {{ id: string, category: string, role: string, label: string, layers: { close: object[] } }[]} */
  const sounds = []
  const missing = []
  for (const pick of picks.picks) {
    const dir = packDir(from, pick.pack)
    if (!dir) {
      missing.push(`${pick.id}: pacote ${pick.pack} não está em ${from}`)
      continue
    }
    if (!listings.has(dir)) listings.set(dir, walk(dir))
    const files = listings.get(dir) ?? []
    /** @type {object[]} */
    const takes = []
    pick.files.forEach((wanted) => {
      const found = files.find((file) => file === wanted || file.endsWith(`/${wanted}`))
      if (!found) {
        missing.push(`${pick.id}: ${pick.pack}/${wanted}`)
        return
      }
      const input = join(dir, found)
      const name = `${pick.id}${pick.loop && !/_loop$/.test(pick.id) ? '_loop' : ''}_${String(takes.length + 1).padStart(2, '0')}`
      const file = `${pick.category}/${name}.ogg`
      const facts = convert(pick.loop ? input : trimTail(input, temp), join(out, file))
      takes.push({
        file,
        sampleRate: facts.sampleRate,
        channels: facts.channels,
        peak: facts.peak,
        seconds: facts.seconds,
        source: `${pick.pack}/${found}`,
        author: picks.author,
        license: picks.license,
      })
    })
    if (takes.length > 0) sounds.push({ id: pick.id, category: pick.category, role: pick.role, label: pick.label, layers: { close: takes } })
  }
  rmSync(temp, { recursive: true, force: true })
  writeFileSync(join(out, 'manifest.json'), `${JSON.stringify({ version: 1, sounds }, null, 2)}\n`)
  const where = relative(process.cwd(), out) || '.'
  console.log(`${sounds.length} som(ns), ${sounds.reduce((sum, sound) => sum + sound.layers.close.length, 0)} arquivo(s) em ${where}${sep}`)
  for (const line of missing) console.error(`✗ ${line}`)
}

main()
