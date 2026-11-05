// @ts-check
// node tools/sfx-sources/fit.mjs [--only <id,id>] [--out packages/game-audio/src/data/fitted-sfx.json]
//
// The recorded sounds, measured into numbers the synthesizer can play: when the files are not on the machine (CI, the published site, a clean
// clone) or not loaded yet, a sound of the kit plays these instead of the old hand-made recipes, so it stays close to the recording.
//
// Each take is split by the same bandpass chains the engine will play (14 bands, 35 Hz to 17 kHz, two WebAudio biquads each: the low rumble of a shot and its bright crack included), and the power of
// each band is followed in 2.5 ms steps. The bands overlap, so the gains are solved jointly (non-negative least squares against what white noise
// through each chain measures in every band). Each band becomes one layer: noise through its chain with a gain curve of a few points (exponential
// ramps down to -80 dB, within 1.5 dB of the measured curve where the sound is loud), scaled to carry the energy measured, out to the tail 70 dB
// down (the field's echo of a shot). The strongest ringing partials (a bell of metal, a glass ping) become sine layers.
// A loop or an ambience keeps only its average spectrum. Only numbers leave the files: no sample of audio is stored.
//
// Needs ffmpeg and the files (packages/game-audio/scripts/sfx-dir.mjs: .sfx-local.json "kit" or KIT_SFX_DIR).
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { hasKitSfx, kitSfxDir } from '../../packages/game-audio/scripts/sfx-dir.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const RATE = 48000
const HOP = 120 // 2.5 ms
/** Band centres (Hz) and their Q: a third of an octave apart, 50 Hz to 16 kHz (26 bands). */
// Two biquads in series per band: the skirts fall 12 dB an octave, so a loud thump at 63 Hz does not hiss at 2 kHz. (Third-octave bands were
// tried: narrow noise flickers in short frames and smears the attack of a shot; they measured further from the recordings.)
export const FIT_BANDS = [35, 63, 125, 200, 320, 500, 800, 1250, 2000, 3150, 5000, 8000, 12500, 17000].map((frequency) => ({ frequency, q: 1.6, stages: 2 }))
/** A loop plays through a parallel bank of single biquads: its bands. */
export const LOOP_BANDS = [63, 125, 200, 320, 500, 800, 1250, 2000, 3150, 5000, 8000, 12500].map((frequency) => ({ frequency, q: 1.6, stages: 1 }))
const MAX_LAYERS = 16
const MAX_PARTIALS = 2
const MAX_TAKES = 4
const MAX_SECONDS = 6
const FLOOR_DB = -80
const END_DB = 70
const TOLERANCE_DB = 1.5
/** Points of a gain curve: 32, more for a long take with several events (an axe chopping), 30 a second up to 160. */
const maxPoints = (/** @type {number} */ seconds) => Math.min(160, Math.max(32, Math.ceil(seconds * 30)))

/** @typedef {{ b0: number, b1: number, b2: number, a1: number, a2: number }} Biquad */

/** The WebAudio bandpass (RBJ, constant 0 dB peak). @param {number} frequency @param {number} q @returns {Biquad} */
function bandpass(frequency, q) {
  const w0 = (2 * Math.PI * frequency) / RATE
  const alpha = Math.sin(w0) / (2 * q)
  const a0 = 1 + alpha
  return { b0: alpha / a0, b1: 0, b2: -alpha / a0, a1: (-2 * Math.cos(w0)) / a0, a2: (1 - alpha) / a0 }
}

/** @param {Float32Array} input @param {Biquad} f @returns {Float32Array} */
function filter(input, f) {
  const out = new Float32Array(input.length)
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < input.length; i++) {
    const x = input[i] ?? 0
    const y = f.b0 * x + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
    out[i] = y
  }
  return out
}

/** Mean square in windows centred on every hop. @param {Float32Array} signal @param {number} window @returns {Float64Array} */
function powerTrack(signal, window) {
  const frames = Math.ceil(signal.length / HOP)
  const prefix = new Float64Array(signal.length + 1)
  for (let i = 0; i < signal.length; i++) prefix[i + 1] = (prefix[i] ?? 0) + (signal[i] ?? 0) ** 2
  const out = new Float64Array(frames)
  const half = Math.floor(window / 2)
  for (let frame = 0; frame < frames; frame++) {
    const centre = frame * HOP
    const from = Math.max(0, centre - half)
    const to = Math.min(signal.length, centre + half)
    out[frame] = to > from ? ((prefix[to] ?? 0) - (prefix[from] ?? 0)) / (to - from) : 0
  }
  return out
}

const windowOf = (/** @type {number} */ frequency) => Math.max(2 * HOP, Math.round(RATE / frequency))
/** @typedef {{ frequency: number, q: number, stages: number }} BandSpec */
/** @typedef {{ bands: BandSpec[], chains: ((input: Float32Array) => Float32Array)[], M: number[][] }} Bank */

/** @param {BandSpec} band @returns {(input: Float32Array) => Float32Array} */
const chainOf = (band) => {
  const f = bandpass(band.frequency, band.q)
  return (input) => {
    let out = input
    for (let stage = 0; stage < band.stages; stage++) out = filter(out, f)
    return out
  }
}

/**
 * The same chain with every other stage run backwards in time: the same magnitude (so the cross matrix holds), but the ringing spreads both ways
 * instead of trailing after the hit.
 * @param {BandSpec} band @returns {(input: Float32Array) => Float32Array}
 */
const balancedChainOf = (band) => {
  const f = bandpass(band.frequency, band.q)
  return (input) => {
    let out = input
    for (let stage = 0; stage < band.stages; stage++) out = stage % 2 === 1 ? filter(out.slice().reverse(), f).reverse() : filter(out, f)
    return out
  }
}

/**
 * The power of a band over time without the filter's own ringing. Up to the loudest frame, the geometric mean of the forward chain (which
 * rings on past the hit) and the balanced one (which spreads part of the attack before the start, where it is lost): each errs the other way,
 * by a few dB, on a shot's boom. After it, the lower of the two: the balanced chain does not trail the hit, so a low end is not measured as
 * lasting longer than it does.
 * @param {Float32Array} signal @param {BandSpec} band @returns {Float64Array}
 */
function bandTrack(signal, band) {
  const window = windowOf(band.frequency)
  const forward = powerTrack(chainOf(band)(signal), window)
  const balanced = powerTrack(balancedChainOf(band)(signal), window)
  let loudest = 0
  for (let frame = 1; frame < forward.length; frame++) if ((forward[frame] ?? 0) > (forward[loudest] ?? 0)) loudest = frame
  return forward.map((value, frame) => (frame <= loudest ? Math.sqrt(value * (balanced[frame] ?? value)) : Math.min(value, balanced[frame] ?? value)))
}

/** @param {BandSpec[]} bands @returns {Bank} */
function bankOf(bands) {
  const chains = bands.map(chainOf)
  return { bands, chains, M: crossMatrix(chains) }
}

/**
 * M[b][c]: what band b measures of white noise through chain c.
 * @param {((input: Float32Array) => Float32Array)[]} filters
 */
function crossMatrix(filters) {
  let seed = 7
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  const noise = new Float32Array(RATE * 4)
  for (let i = 0; i < noise.length; i++) noise[i] = random() * 2 - 1
  return filters.map((fb) => filters.map((fc) => {
    const y = fb(fc(noise))
    let sum = 0
    for (let i = RATE; i < y.length; i++) sum += (y[i] ?? 0) ** 2
    return sum / (y.length - RATE)
  }))
}
const TAKE_BANK = bankOf(FIT_BANDS)
const LOOP_BANK = bankOf(LOOP_BANDS)

/** @param {string} file @returns {Float32Array} */
function decode(file) {
  const raw = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-'], { maxBuffer: 1024 * 1024 * 1024 })
  return new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength))
}

/** Per frame, the noise power each chain needs (x ≥ 0 with M x ≈ measured). @param {Float64Array[]} measured @param {number[][]} M @returns {Float64Array[]} */
function solveGains(measured, M) {
  const bands = M.length
  const frames = measured[0]?.length ?? 0
  const out = M.map(() => new Float64Array(frames))
  const x = new Float64Array(bands)
  for (let frame = 0; frame < frames; frame++) {
    const p = measured.map((track) => track[frame] ?? 0)
    // the last frame's answer is where this one starts: the bands do not jump from one frame to the next for nothing
    for (let c = 0; c < bands; c++) x[c] = frame > 0 ? Math.max(1e-20, ((out[c]?.[frame - 1] ?? 0) + (p[c] ?? 0) / (M[c]?.[c] ?? 1)) / 2) : Math.max(1e-20, (p[c] ?? 0) / (M[c]?.[c] ?? 1))
    const mtp = new Float64Array(bands)
    for (let c = 0; c < bands; c++) for (let b = 0; b < bands; b++) mtp[c] = (mtp[c] ?? 0) + (M[b]?.[c] ?? 0) * (p[b] ?? 0)
    for (let iteration = 0; iteration < 80; iteration++) {
      const mx = new Float64Array(bands)
      for (let b = 0; b < bands; b++) for (let c = 0; c < bands; c++) mx[b] = (mx[b] ?? 0) + (M[b]?.[c] ?? 0) * (x[c] ?? 0)
      for (let c = 0; c < bands; c++) {
        let mtmx = 0
        for (let b = 0; b < bands; b++) mtmx += (M[b]?.[c] ?? 0) * (mx[b] ?? 0)
        x[c] = (x[c] ?? 0) * ((mtp[c] ?? 0) / (mtmx + 1e-30))
      }
    }
    for (let c = 0; c < bands; c++) (out[c] ?? new Float64Array(0))[frame] = x[c] ?? 0
  }
  return out
}

/**
 * The fewest points (time, dB) whose straight lines stay within the tolerance of the curve.
 * @param {number[]} times @param {number[]} db @returns {number[]} indices kept
 */
function simplify(times, db) {
  /** @type {Set<number>} */
  const keep = new Set([0, times.length - 1])
  /** @param {number} from @param {number} to */
  const split = (from, to) => {
    let worst = -1
    let error = TOLERANCE_DB
    for (let i = from + 1; i < to; i++) {
      const span = (times[to] ?? 0) - (times[from] ?? 0)
      const t = span > 0 ? ((times[i] ?? 0) - (times[from] ?? 0)) / span : 0
      const line = (db[from] ?? 0) + t * ((db[to] ?? 0) - (db[from] ?? 0))
      // a quiet part needs less care than the body of the sound: the tolerance widens below -30 dB
      const e = Math.abs((db[i] ?? 0) - line) - Math.max(0, -30 - Math.max(db[i] ?? 0, line)) * 0.1
      if (e > error) {
        error = e
        worst = i
      }
    }
    if (worst >= 0) {
      keep.add(worst)
      split(from, worst)
      split(worst, to)
    }
  }
  split(0, times.length - 1)
  let kept = [...keep].sort((a, b) => a - b)
  // too many points: keep the largest moves
  const limit = maxPoints(times[times.length - 1] ?? 0)
  while (kept.length > limit) {
    let least = 1
    let leastError = Infinity
    for (let k = 1; k < kept.length - 1; k++) {
      const a = kept[k - 1] ?? 0
      const i = kept[k] ?? 0
      const b = kept[k + 1] ?? 0
      const span = (times[b] ?? 0) - (times[a] ?? 0)
      const t = span > 0 ? ((times[i] ?? 0) - (times[a] ?? 0)) / span : 0
      const e = Math.abs((db[i] ?? 0) - ((db[a] ?? 0) + t * ((db[b] ?? 0) - (db[a] ?? 0))))
      if (e < leastError) {
        leastError = e
        least = k
      }
    }
    kept = kept.filter((_, k) => k !== least)
  }
  return kept
}

const round = (/** @type {number} */ value, /** @type {number} */ digits) => Math.round(value * 10 ** digits) / 10 ** digits

/**
 * Ringing partials: narrow peaks standing at least 15 dB above the spectrum around them in the first half second, that last.
 * @param {Float32Array} signal @returns {{ frequency: number, prominence: number }[]}
 */
function partials(signal) {
  const size = 8192
  const start = 0
  const re = new Float64Array(size)
  const im = new Float64Array(size)
  for (let i = 0; i < size; i++) re[i] = (signal[start + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)))
  fft(re, im)
  const mag = new Float64Array(size / 2)
  for (let k = 0; k < size / 2; k++) mag[k] = 10 * Math.log10((re[k] ?? 0) ** 2 + (im[k] ?? 0) ** 2 + 1e-20)
  const top = Math.max(...mag)
  /** @type {{ frequency: number, prominence: number, level: number }[]} */
  const peaks = []
  for (let k = 8; k < size / 2 - 8; k++) {
    const frequency = (k * RATE) / size
    if (frequency < 150 || frequency > 12000) continue
    const v = mag[k] ?? 0
    if (v < top - 30) continue
    let isPeak = true
    for (let j = k - 3; j <= k + 3; j++) if (j !== k && (mag[j] ?? 0) > v) isPeak = false
    if (!isPeak) continue
    // the level around it: the median of the third of an octave on each side, without the peak itself
    const width = Math.max(6, Math.round(k * 0.12))
    const around = []
    for (let j = k - width; j <= k + width; j++) if (Math.abs(j - k) > 4 && j > 0 && j < size / 2) around.push(mag[j] ?? 0)
    around.sort((a, b) => a - b)
    const median = around[Math.floor(around.length / 2)] ?? v
    if (v - median >= 18) peaks.push({ frequency, prominence: v - median, level: v })
  }
  peaks.sort((a, b) => b.level - a.level)
  return peaks.slice(0, MAX_PARTIALS + 1).map(({ frequency, prominence }) => ({ frequency: round(frequency, 1), prominence: round(prominence, 1) }))
}

/** In-place radix-2 FFT. @param {Float64Array} re @param {Float64Array} im */
function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j] ?? 0, re[i] ?? 0]
      ;[im[i], im[j]] = [im[j] ?? 0, im[i] ?? 0]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len
    const wr = Math.cos(angle)
    const wi = Math.sin(angle)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let j = 0; j < len / 2; j++) {
        const a = i + j
        const b = a + len / 2
        const tr = (re[b] ?? 0) * cr - (im[b] ?? 0) * ci
        const ti = (re[b] ?? 0) * ci + (im[b] ?? 0) * cr
        re[b] = (re[a] ?? 0) - tr
        im[b] = (im[a] ?? 0) - ti
        re[a] = (re[a] ?? 0) + tr
        im[a] = (im[a] ?? 0) + ti
        const next = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = next
      }
    }
  }
}

/** @typedef {{ band?: number, frequency?: number, q?: number, wave?: 'sine', gain: number, env: [number, number][] }} FitLayer */
/** @typedef {{ duration: number, layers: FitLayer[] }} FitTake */

/**
 * A one-shot take: its band layers and its partials.
 * @param {Float32Array} full @returns {FitTake}
 */
export function fitTake(full) {
  const signal = full.length > MAX_SECONDS * RATE ? full.subarray(0, MAX_SECONDS * RATE) : full
  const measured = FIT_BANDS.map((band) => bandTrack(signal, band))
  const gains = solveGains(measured, TAKE_BANK.M)
  const frames = gains[0]?.length ?? 0
  const amplitude = gains.map((track) => Array.from(track, (x) => Math.sqrt(Math.max(0, x))))
  const peaks = amplitude.map((track) => Math.max(...track))
  const top = Math.max(...peaks)
  // the end: the last frame any band is within END_DB of the loudest (the field's echo of a shot is 50 to 60 dB down)
  let last = 0
  for (let frame = 0; frame < frames; frame++) if (amplitude.some((track) => (track[frame] ?? 0) > top * 10 ** (-END_DB / 20))) last = frame
  const end = Math.min(frames - 1, last + 4)
  const duration = round(((end + 1) * HOP) / RATE, 3)
  // energy of each band over the take, to keep the strongest
  const energy = amplitude.map((track) => track.slice(0, end + 1).reduce((sum, value) => sum + value * value, 0))
  /** @type {FitLayer[]} */
  const layers = []
  const order = energy.map((value, band) => ({ value, band })).sort((a, b) => b.value - a.value)
  const strongest = order[0]?.value ?? 0
  const tonal = partials(signal)
  const bandSlots = MAX_LAYERS - Math.min(MAX_PARTIALS, tonal.length)
  for (const { value, band } of order.slice(0, bandSlots)) {
    if (value < strongest * 10 ** (-45 / 10)) continue
    layers.push(envelopeLayer({ band }, amplitude[band] ?? [], end))
  }
  for (const partial of tonal.slice(0, MAX_PARTIALS)) {
    const narrow = bandpass(partial.frequency, 40)
    const track = Array.from(powerTrack(filter(signal, narrow), windowOf(partial.frequency) * 2), (p) => Math.sqrt(Math.max(0, 2 * p)))
    layers.push(envelopeLayer({ frequency: partial.frequency, wave: 'sine' }, track, end))
  }
  return { duration, layers }
}

/** @param {Omit<FitLayer, 'gain' | 'env'>} what @param {number[]} track @param {number} end @returns {FitLayer} */
function envelopeLayer(what, track, end) {
  const peak = Math.max(1e-9, ...track.slice(0, end + 1))
  /** @type {number[]} */
  const times = []
  /** @type {number[]} */
  const db = []
  for (let frame = 0; frame <= end; frame++) {
    times.push((frame * HOP) / RATE)
    db.push(Math.max(FLOOR_DB, 20 * Math.log10(Math.max(1e-9, (track[frame] ?? 0) / peak))))
  }
  // a median of five frames takes out the flicker the solver leaves between bands
  const smooth = db.map((_, i) => {
    const near = db.slice(Math.max(0, i - 2), i + 3).sort((a, b) => a - b)
    return i < 3 ? (db[i] ?? FLOOR_DB) : (near[Math.floor(near.length / 2)] ?? FLOOR_DB)
  })
  db.splice(0, db.length, ...smooth)
  const kept = simplify(times, db)
  /** @type {[number, number][]} */
  const env = kept.map((index) => [round(times[index] ?? 0, 3), Number((10 ** ((db[index] ?? FLOOR_DB) / 20)).toPrecision(2))])
  // the curve is simplified in dB, which sits under a noisy power track: scale it so the layer carries the energy measured
  const measured = track.slice(0, end + 1).reduce((sum, value) => sum + value * value, 0)
  const drawn = energyOf(env, end) * peak * peak
  const scale = drawn <= 0 ? 1 : Math.sqrt(measured / drawn)
  return { ...what, gain: Number((peak * scale).toPrecision(4)), env }
}

/**
 * The energy of a curve played as exponential ramps, sampled every hop (what the engine draws between the points).
 * @param {[number, number][]} env @param {number} end
 */
function energyOf(env, end) {
  let sum = 0
  let point = 0
  for (let frame = 0; frame <= end; frame++) {
    const t = (frame * HOP) / RATE
    while (point < env.length - 2 && (env[point + 1]?.[0] ?? 0) <= t) point++
    const [t0, v0] = env[point] ?? [0, 0]
    const [t1, v1] = env[point + 1] ?? [t0, v0]
    const a = Math.max(0.001, v0)
    const b = Math.max(0.001, v1)
    const u = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0
    const v = t < t0 ? a : a * (b / a) ** u
    sum += v * v
  }
  return sum
}

/** A loop: the average gain of each band over the steady part. @param {Float32Array} signal @returns {{ band: number, gain: number }[]} */
export function fitLoop(signal) {
  const cut = signal.length > RATE * 30 ? signal.subarray(RATE * 2, RATE * 30) : signal
  const measured = LOOP_BANK.chains.map((chain, b) => powerTrack(chain(cut), windowOf(LOOP_BANDS[b]?.frequency ?? 1000)))
  const mean = measured.map((track) => {
    const from = Math.floor(track.length * 0.05)
    const to = Math.max(from + 1, Math.floor(track.length * 0.95))
    let sum = 0
    for (let i = from; i < to; i++) sum += track[i] ?? 0
    return Float64Array.of(sum / (to - from))
  })
  const solved = solveGains(mean, LOOP_BANK.M)
  const gains = solved.map((x, band) => ({ band, gain: round(Math.sqrt(Math.max(0, x[0] ?? 0)), 5) }))
  const top = Math.max(...gains.map((g) => g.gain))
  return gains.filter((g) => g.gain > top * 10 ** (-40 / 20))
}

/** Loops and ambiences keep a spectrum; the rest are one-shots. @param {{ id: string, category: string }} sound */
export const isLoopSound = (sound) => /_loop(_|$)/.test(sound.id) || sound.category === 'ambiente' || sound.id === 'water_faucet'

function main() {
  const args = process.argv.slice(2)
  const only = args.includes('--only') ? new Set((args[args.indexOf('--only') + 1] ?? '').split(',')) : null
  const out = args.includes('--out') ? resolve(args[args.indexOf('--out') + 1] ?? '') : join(root, 'packages/game-audio/src/data/fitted-sfx.json')
  if (!hasKitSfx(root)) {
    console.error(`fit: no sound files at ${kitSfxDir(root)} (.sfx-local.json "kit" or KIT_SFX_DIR)`)
    process.exit(1)
  }
  const files = kitSfxDir(root)
  /** @type {{ sounds: { id: string, category: string, layers: Record<string, { file: string, source: string, author: string, license: string }[]> }[] }} */
  const manifest = JSON.parse(readFileSync(join(root, 'packages/game-audio/assets/sfx/manifest.json'), 'utf8'))
  /** @type {{ sounds: unknown[] }} */
  const previous = existsSync(out) && only ? JSON.parse(readFileSync(out, 'utf8')) : { sounds: [] }
  const kept = /** @type {{ id: string }[]} */ (previous.sounds).filter((sound) => !only?.has(sound.id))
  const sounds = []
  for (const sound of manifest.sounds) {
    if (only && !only.has(sound.id)) continue
    if (sound.category === 'veiculos') continue // the vehicle bank answers its own ids
    const takes = (sound.layers.close ?? []).slice(0, MAX_TAKES)
    if (takes.length === 0) continue
    const sources = [...new Set(takes.map((take) => `${take.author} (${take.license}) ${take.source}`))]
    if (isLoopSound(sound)) {
      const bands = fitLoop(decode(join(files, takes[0]?.file ?? '')))
      sounds.push({ id: sound.id, category: sound.category, loop: { bands }, sources })
    } else {
      const fitted = takes.map((take) => fitTake(decode(join(files, take.file))))
      sounds.push({ id: sound.id, category: sound.category, takes: fitted, sources })
    }
    console.log(`✓ ${sound.category}/${sound.id}`)
  }
  const all = [...kept, ...sounds].sort((a, b) => (/** @type {{ id: string }} */ (a)).id.localeCompare((/** @type {{ id: string }} */ (b)).id))
  const data = {
    $comment: 'Generated by tools/sfx-sources/fit.mjs from the recorded files (ZombiAdA assets/sfx): numbers only, no audio. Each one-shot take is noise through the bands below with a gain curve per band ([seconds, 0..1], exponential ramps) and the ringing partials as sines; a loop keeps its average band gains. The authors of the recordings are credited in packages/game-audio/assets/sfx/CREDITOS.md.',
    rate: RATE,
    bands: FIT_BANDS,
    loopBands: LOOP_BANDS,
    sounds: all,
  }
  writeFileSync(out, `${JSON.stringify(data)}\n`)
  console.log(`${sounds.length} sound(s) fitted → ${out}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
