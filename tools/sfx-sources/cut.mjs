// @ts-check
// node tools/sfx-sources/cut.mjs --ffl <FreeFirearmsSFXLibrary checkout> --rfs <restrained-firearms-soundpack checkout> --oap <Meta-open-sound checkout>
//   [--out assets/sfx-inbox/armas] [--dry-run]
//
// Cuts the recorded tracks that tools/sfx-sources/firearms.json names into one file per take for the sound inbox: every track holds a few
// repetitions of the same shot or action, separated by silence. A take starts a few ms before its attack and ends when it fades into the room
// noise (or at the cap of its kind), with a short fade-out. It writes `<id>_<close|far>_<nn>.wav` (mechanics: `<id>_<nn>.wav`) in 48 kHz mono and
// the matching lines of assets/sfx-inbox/CREDITOS.md (`arquivo | link | autor | licença`, one per file). Then run
// `pnpm --filter @adatechnology/game-audio sfx:convert --only armas`. Needs ffmpeg.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const RATE = 48000
/** Envelope block: 2 ms. */
const BLOCK = 96

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {{ ffl: string | null, rfs: string | null, oap: string | null, out: string, credits: string, dryRun: boolean }} */
  const args = { ffl: null, rfs: null, oap: null, out: join(root, 'assets/sfx-inbox/armas'), credits: join(root, 'assets/sfx-inbox/CREDITOS.md'), dryRun: false }
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index]
    const value = () => {
      const next = argv[++index]
      if (next === undefined) throw new Error(`${flag} needs a value`)
      return resolve(next)
    }
    if (flag === '--ffl') args.ffl = value()
    else if (flag === '--rfs') args.rfs = value()
    else if (flag === '--oap') args.oap = value()
    else if (flag === '--out') args.out = value()
    else if (flag === '--credits') args.credits = value()
    else if (flag === '--dry-run') args.dryRun = true
    else throw new Error(`unknown flag ${flag}`)
  }
  return args
}

/**
 * The track as mono samples at 48 kHz.
 * @param {string} file
 */
function decode(file) {
  const raw = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-'], { maxBuffer: 1024 * 1024 * 1024 })
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4)
}

/** @param {number} value */
const db = (value) => 20 * Math.log10(Math.max(1e-9, value))

/**
 * @typedef {{ start: number, end: number, peak: number }} Take
 * @typedef {{ maxSeconds: number, minSeconds: number, mergeGap: number, below: number, keep: number }} Kind
 */

/** Shots ring out longer and come one per burst of silence; a mechanical action may be two clicks a fraction of a second apart. */
const KINDS = /** @type {const} */ ({
  close: { maxSeconds: 1.6, minSeconds: 0.5, mergeGap: 0.15, below: 50, keep: 12 },
  far: { maxSeconds: 2.6, minSeconds: 1.2, mergeGap: 0.25, below: 45, keep: 12 },
  mech: { maxSeconds: 1.2, minSeconds: 0.12, mergeGap: 0.3, below: 45, keep: 15 },
})

/**
 * The takes of a track: where each repetition starts and ends, in samples.
 * @param {Float32Array} samples
 * @param {Kind} kind
 * @returns {Take[]}
 */
export function findTakes(samples, kind) {
  const blocks = Math.floor(samples.length / BLOCK)
  const env = new Float64Array(blocks)
  for (let block = 0; block < blocks; block++) {
    let max = 0
    for (let index = block * BLOCK; index < (block + 1) * BLOCK; index++) max = Math.max(max, Math.abs(samples[index] ?? 0))
    env[block] = db(max)
  }
  const sorted = [...env].sort((a, b) => a - b)
  const floor = sorted[Math.floor(sorted.length * 0.2)] ?? -120
  const peak = sorted[sorted.length - 1] ?? -120
  const on = Math.max(peak - 30, floor + 15)
  /** @type {Take[]} */
  const raw = []
  let block = 0
  while (block < blocks) {
    if ((env[block] ?? -120) < on) {
      block++
      continue
    }
    const start = block
    let local = env[block] ?? -120
    let quiet = 0
    let end = block
    const cap = start + Math.round((kind.maxSeconds * RATE) / BLOCK)
    for (end = block; end < blocks && end < cap; end++) {
      const level = env[end] ?? -120
      local = Math.max(local, level)
      quiet = level < Math.max(local - kind.below, floor + 1) ? quiet + 1 : 0
      if (quiet >= 30) break
    }
    raw.push({ start, end, peak: local })
    block = end + 1
    // after a capped take, skip the rest of its ring before looking for the next attack
    while (block < blocks && (env[block] ?? -120) >= on - 6 && block - end < 2000) block++
  }
  /** @type {Take[]} */
  const merged = []
  for (const take of raw) {
    const last = merged[merged.length - 1]
    if (last && ((take.start - last.end) * BLOCK) / RATE < kind.mergeGap && ((take.end - last.start) * BLOCK) / RATE <= kind.maxSeconds) {
      last.end = take.end
      last.peak = Math.max(last.peak, take.peak)
    } else merged.push({ ...take })
  }
  const kept = merged.filter((take) => take.peak >= peak - kind.keep && take.end - take.start >= 4)
  // a take keeps at least `minSeconds` of its own decay (the room after a shot), never running into the next one
  const minBlocks = Math.round((kind.minSeconds * RATE) / BLOCK)
  return kept.map((take, index) => {
    const next = kept[index + 1]?.start ?? blocks
    const end = Math.min(next - 5, Math.max(take.end, take.start + minBlocks))
    return { start: Math.max(0, take.start * BLOCK - Math.round(0.004 * RATE)), end: Math.min(samples.length, Math.max(take.end, end) * BLOCK + Math.round(0.01 * RATE)), peak: take.peak }
  })
}

/**
 * Writes one take: 48 kHz mono 24-bit with a 25 ms fade-out.
 * @param {string} source
 * @param {Take} take
 * @param {string} target
 */
function writeTake(source, take, target) {
  const seconds = (take.end - take.start) / RATE
  const fade = Math.min(0.025, seconds / 4)
  // seek on the input, so the fade's clock starts at the take
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', (take.start / RATE).toFixed(4), '-t', seconds.toFixed(4), '-i', source, '-ac', '1', '-ar', String(RATE), '-af', `afade=t=out:st=${(seconds - fade).toFixed(4)}:d=${fade.toFixed(4)}`, '-c:a', 'pcm_s24le', target])
}

/**
 * The file of a track code: `X_39` → `Master Tracks/Walther PPQ/X_39.wav`; `rfs:<path>` → that file of the Restrained pack.
 * @param {string} code
 * @param {{ ffl: string | null, rfs: string | null, oap: string | null }} roots
 */
function trackFile(code, roots) {
  if (code.startsWith('oap:')) {
    if (!roots.oap) throw new Error('--oap is needed for ' + code)
    return { file: join(roots.oap, 'corpora/oculus-audio-pack/ogg', code.slice(4)), source: 'oap' }
  }
  if (code.startsWith('rfs:')) {
    if (!roots.rfs) throw new Error('--rfs is needed for ' + code)
    return { file: join(roots.rfs, code.slice(4)), source: 'rfs' }
  }
  if (!roots.ffl) throw new Error('--ffl is needed for ' + code)
  const tracks = join(roots.ffl, 'Master Tracks')
  for (const folder of readdirSync(tracks)) {
    const file = join(tracks, folder, `${code}.wav`)
    if (existsSync(file)) return { file, source: 'ffl' }
  }
  throw new Error(`track ${code} is not in ${tracks} (add it to the sparse checkout)`)
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  /** @type {{ sources: Record<string, { link: string, author: string, license: string }>, shots: Record<string, Record<'close' | 'far', string[]>>, mechanics: Record<string, string[]>, casings?: Record<string, string[]> }} */
  const spec = JSON.parse(readFileSync(join(here, 'firearms.json'), 'utf8'))
  /** @type {{ id: string, layer: 'close' | 'far' | 'mech' | 'whole', tracks: string[], perTrack: number }[]} */
  const jobs = []
  for (const [id, layers] of Object.entries(spec.shots)) for (const layer of /** @type {const} */ (['close', 'far'])) jobs.push({ id, layer, tracks: layers[layer] ?? [], perTrack: 4 })
  for (const [id, tracks] of Object.entries(spec.mechanics)) jobs.push({ id, layer: 'mech', tracks, perTrack: tracks.length > 2 ? 3 : 4 })
  // files that are already one take each (a case's bounces): copied whole
  for (const [id, tracks] of Object.entries(spec.casings ?? {})) jobs.push({ id, layer: 'whole', tracks, perTrack: 1 })
  if (!args.dryRun) mkdirSync(args.out, { recursive: true })
  /** @type {string[]} */
  const credits = []
  for (const job of jobs) {
    let count = 0
    for (const code of job.tracks) {
      const { file, source } = trackFile(code, args)
      const samples = decode(file)
      const takes = job.layer === 'whole' ? [{ start: 0, end: samples.length, peak: 0 }] : findTakes(samples, KINDS[job.layer]).slice(0, job.perTrack)
      if (takes.length === 0) console.warn(`  ${job.id}: no take found in ${code}`)
      for (const take of takes) {
        count++
        const name = `${job.id}${job.layer === 'mech' || job.layer === 'whole' ? '' : `_${job.layer}`}_${String(count).padStart(2, '0')}.wav`
        const info = spec.sources[source]
        if (!info) throw new Error(`unknown source ${source}`)
        const track = code.includes(':') ? code.slice(4).split('/').pop() : code
        credits.push(`| armas/${name} | ${info.link} (${track}) | ${info.author} | ${info.license} |`)
        if (!args.dryRun) writeTake(file, take, join(args.out, name))
      }
    }
    console.log(`${job.id}${job.layer === 'mech' || job.layer === 'whole' ? '' : ` ${job.layer}`}: ${count} takes`)
  }
  if (args.dryRun) return
  // the inbox credits: the lines of armas/ replaced, every other line kept
  const previous = existsSync(args.credits) ? readFileSync(args.credits, 'utf8').split('\n') : []
  const kept = previous.filter((line) => !/^\|\s*armas\//.test(line.trim()))
  while (kept.length > 0 && kept[kept.length - 1] === '') kept.pop()
  writeFileSync(args.credits, [...kept, ...credits, ''].join('\n'))
}

main()
