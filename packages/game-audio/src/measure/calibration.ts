/**
 * The calibration sound of the measuring harness: a sample sound made by the kit in code (no file, no licence), with every layer the criteria ask
 * for, so the harness can prove the whole file path (bytes → decode → plan → WebAudio) before any real file exists. Each take is a WAV built here:
 * an attack on the first sample (a click and a short noise burst over a low thump that decays), four near takes with their own pitch and noise, a far
 * take (darker, slower attack of the echo), light and heavy tiers and the two tails (a short dense room, a long thin field).
 */
import { createRng } from '../rng'
import type { SampleSound } from '../sample'
import type { SampleLoader } from '../webaudio/sample-store'

export const CALIBRATION_ID = 'calibration_shot'
export const CALIBRATION_RATE = 48000

/** 16-bit PCM mono WAV bytes of the samples (clamped to ±1). */
export function encodeWav(samples: Float32Array, sampleRate = CALIBRATION_RATE): ArrayBuffer {
  const bytes = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(bytes)
  const text = (at: number, value: string): void => {
    for (let index = 0; index < value.length; index++) view.setUint8(at + index, value.charCodeAt(index))
  }
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let index = 0; index < samples.length; index++) {
    const value = Math.max(-1, Math.min(1, samples[index] as number))
    view.setInt16(44 + index * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true)
  }
  return bytes
}

type Shot = { readonly seconds: number; readonly thump: number; readonly noise: number; readonly decay: number; readonly brightness: number; readonly gain: number; readonly seed: number; readonly attack?: number }

/** One take: a thump (sine glide) and a noise burst, both decaying, smoothed by a one-pole lowpass (`brightness` 0..1), faded out at the end. */
export function shotSamples(shot: Shot, sampleRate = CALIBRATION_RATE): Float32Array {
  const random = createRng(shot.seed)
  const length = Math.round(shot.seconds * sampleRate)
  const samples = new Float32Array(length)
  let low = 0
  let phase = 0
  const attack = Math.max(1, Math.round((shot.attack ?? 0) * sampleRate))
  for (let index = 0; index < length; index++) {
    const time = index / sampleRate
    const envelope = Math.exp(-time / shot.decay) * Math.min(1, (index + 1) / attack)
    phase += (2 * Math.PI * shot.thump * (1 + 0.6 * Math.exp(-time * 30))) / sampleRate
    const noise = random() * 2 - 1
    low += shot.brightness * (noise - low)
    const fade = Math.min(1, (length - index) / (0.01 * sampleRate))
    samples[index] = shot.gain * envelope * fade * (0.55 * Math.sin(phase) + shot.noise * low)
  }
  return samples
}

const TAKES: Readonly<Record<string, Shot>> = {
  'close_1.wav': { seconds: 0.4, thump: 150, noise: 1, decay: 0.06, brightness: 0.9, gain: 0.85, seed: 1 },
  'close_2.wav': { seconds: 0.4, thump: 160, noise: 1, decay: 0.065, brightness: 0.85, gain: 0.85, seed: 2 },
  'close_3.wav': { seconds: 0.4, thump: 142, noise: 1, decay: 0.055, brightness: 0.95, gain: 0.85, seed: 3 },
  'close_4.wav': { seconds: 0.4, thump: 170, noise: 1, decay: 0.07, brightness: 0.8, gain: 0.85, seed: 4 },
  'far_1.wav': { seconds: 0.9, thump: 90, noise: 0.8, decay: 0.2, brightness: 0.08, gain: 0.7, seed: 5, attack: 0.004 },
  'far_2.wav': { seconds: 0.9, thump: 95, noise: 0.8, decay: 0.22, brightness: 0.07, gain: 0.7, seed: 6, attack: 0.004 },
  'light_1.wav': { seconds: 0.25, thump: 220, noise: 0.6, decay: 0.03, brightness: 0.6, gain: 0.35, seed: 7 },
  'light_2.wav': { seconds: 0.25, thump: 230, noise: 0.6, decay: 0.03, brightness: 0.55, gain: 0.35, seed: 8 },
  'heavy_1.wav': { seconds: 0.6, thump: 110, noise: 1.2, decay: 0.11, brightness: 0.95, gain: 0.95, seed: 9 },
  'heavy_2.wav': { seconds: 0.6, thump: 105, noise: 1.2, decay: 0.12, brightness: 0.9, gain: 0.95, seed: 10 },
  'tail_in.wav': { seconds: 0.5, thump: 0, noise: 1, decay: 0.08, brightness: 0.4, gain: 0.25, seed: 11, attack: 0.01 },
  'tail_out.wav': { seconds: 2, thump: 0, noise: 1, decay: 0.45, brightness: 0.25, gain: 0.2, seed: 12, attack: 0.02 },
}

const PREFIX = 'calibration/'
const url = (name: string): string => `${PREFIX}${name}`

/** The calibration sound (weapons bus, every layer, fallback to the game's pistol noise class). */
export const CALIBRATION_SOUND: SampleSound = {
  id: CALIBRATION_ID,
  bus: 'weapons',
  close: ['close_1.wav', 'close_2.wav', 'close_3.wav', 'close_4.wav'].map((name) => ({ url: url(name) })),
  far: ['far_1.wav', 'far_2.wav'].map((name) => ({ url: url(name) })),
  tiers: [
    { name: 'light', from: 0, close: ['light_1.wav', 'light_2.wav'].map((name) => ({ url: url(name) })) },
    { name: 'medium', from: 0.34, close: ['close_1.wav', 'close_2.wav', 'close_3.wav', 'close_4.wav'].map((name) => ({ url: url(name) })) },
    { name: 'heavy', from: 0.67, close: ['heavy_1.wav', 'heavy_2.wav'].map((name) => ({ url: url(name) })) },
  ],
  tail: { indoor: [{ url: url('tail_in.wav') }], outdoor: [{ url: url('tail_out.wav') }] },
  pitch: 0.04,
  choke: { voices: 2 },
  fallback: 'sfx_pistol',
  sources: ['sdk: calibration takes synthesized by the harness (measure/calibration.ts), no file, no licence'],
}

/** Bytes of the calibration takes (made on demand, the same for the same name). Falls through to `next` for any other url. */
export function calibrationLoader(next?: SampleLoader): SampleLoader {
  const made = new Map<string, ArrayBuffer>()
  return async (requested) => {
    if (!requested.startsWith(PREFIX)) {
      if (next) return next(requested)
      throw new Error(`not a calibration file: ${requested}`)
    }
    const name = requested.slice(PREFIX.length)
    const shot = TAKES[name]
    if (!shot) throw new Error(`no calibration take ${name}`)
    let bytes = made.get(name)
    if (!bytes) {
      bytes = encodeWav(shotSamples(shot))
      made.set(name, bytes)
    }
    // decodeAudioData detaches what it gets: every load gets its own copy
    return bytes.slice(0)
  }
}
