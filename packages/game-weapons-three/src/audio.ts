// Weapon sounds synthesized with WebAudio: no sound files, so the kit stays offline and small. Every call is a no-op where there is no
// AudioContext (tests, workers), and the context is only created on the first sound, which comes from a click or a key (browsers allow it).
// The numbers live in ./audio/*: `computeShotSound` is pure and this file only turns its result into nodes.
import { createRng } from '@adatechnology/game-weapons'
import type { WeaponEvent } from '@adatechnology/game-weapons'

import { MECHANICAL_SOUNDS, mechanicalSoundOf } from './audio/mechanical-sounds'
import type { MechanicalSoundId, SoundStep } from './audio/mechanical-sounds'
import { computeShotSound, FALLBACK_SOUND_CLASS, GAME_DISTANCE_CURVE, GAME_SOUND_CLASSES } from './audio/shot-sound'
import type { ShotSound, ShotSoundInput, ShotSoundOptions, SoundClassDef } from './audio/shot-sound'

export { computeShotSound, GAME_SOUND_CLASSES, GAME_DISTANCE_CURVE, DEFAULT_ENERGY_CURVE, CLASS_REFERENCE_ENERGY } from './audio/shot-sound'
export type { ShotSound, ShotSoundInput, ShotSoundOptions, ShotSoundClass, SoundClassDef, DistanceCurve, EnergyCurve } from './audio/shot-sound'
export { MECHANICAL_SOUNDS, mechanicalSoundOf } from './audio/mechanical-sounds'
export type { MechanicalSoundId, SoundStep } from './audio/mechanical-sounds'

/** What a shot adds to the energy and the category: where the listener is and how the weapon is set. */
export type ShotExtras = Pick<ShotSoundInput, 'caliber' | 'distance' | 'volume' | 'suppressed' | 'indoors'>

export interface WeaponAudioOptions extends ShotSoundOptions {
  /** Seed of the noise buffer, of the start point in it and of the casing pitch: same seed, same sound. Default 1. */
  readonly seed?: number
  /** Replaces or adds mechanical sounds by id. */
  readonly mechanical?: Readonly<Partial<Record<MechanicalSoundId, readonly SoundStep[]>>>
  /** Where the AudioContext comes from (default: the global one); lets a host or a test lend its own. */
  readonly createContext?: () => AudioContext
}

/** Sounds the weapon presentation plays. */
export interface WeaponAudio {
  /** A shot: class and distance muffling of the game, loudness and body from the muzzle energy (joules). */
  shot(energyJ: number, category: string, extras?: ShotExtras): void
  /** The parameters `shot` would play (pure). */
  shotSound(input: ShotSoundInput): ShotSound
  /** Dry click of an empty weapon. */
  click(): void
  /** A mechanical sound by id: a reload stage, `dry_fire`, `jam`, `safety_on`... */
  mechanical(id: MechanicalSoundId): void
  /** The mechanical sound of a weapon event, if it has one (reload stages, empty, misfire, fault, clear, safety, mode, feed). */
  event(event: WeaponEvent): void
  /** A sound class of the game by name (`impact`, `flesh`, `glass`...), with the game's distance muffling. */
  play(soundClass: string, volume?: number, distance?: number): void
  /** Magazine out, or the first shell in. */
  reloadStart(category: string): void
  /** Magazine seated and the action racked. */
  reloadEnd(category: string): void
  /** The pump or lever cycling after a shot. */
  cycle(): void
  /** A casing bouncing on the floor. */
  clink(): void
  /** A magazine landing on the floor. */
  thud(): void
  /** Master volume, 0 to 1. */
  setVolume(volume: number): void
  dispose(): void
}

type AudioContextCtor = new () => AudioContext

const NOISE_SECONDS = 1.5

const globalContext = (): AudioContext | null => {
  const scope = globalThis as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }
  const Ctor = scope.AudioContext ?? scope.webkitAudioContext
  return Ctor ? new Ctor() : null
}

export function createWeaponAudio(volume = 0.6, options: WeaponAudioOptions = {}): WeaponAudio {
  const makeContext = options.createContext ?? globalContext
  const rng = createRng(options.seed ?? 1)
  const classes: Readonly<Record<string, SoundClassDef>> = { ...GAME_SOUND_CLASSES, ...options.classes }
  const distanceCurve = { ...GAME_DISTANCE_CURVE, ...options.distance }
  const mechanicalTable = { ...MECHANICAL_SOUNDS, ...options.mechanical }
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let noise: AudioBuffer | null = null
  let level = volume

  const ready = (): AudioContext | null => {
    if (!ctx) {
      const created = makeContext()
      if (!created) return null
      ctx = created
      master = ctx.createGain()
      master.gain.value = level
      master.connect(ctx.destination)
      noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * NOISE_SECONDS), ctx.sampleRate)
      const data = noise.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = rng() * 2 - 1
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  }

  // a filtered noise burst with a fast attack and an exponential tail
  const burst = (config: { at?: number; seconds: number; gain: number; filter: BiquadFilterType; frequency: number; q?: number }): void => {
    const audio = ready()
    if (!audio || !noise || !master) return
    const start = audio.currentTime + (config.at ?? 0)
    const source = audio.createBufferSource()
    source.buffer = noise
    const filter = audio.createBiquadFilter()
    filter.type = config.filter
    filter.frequency.value = config.frequency
    filter.Q.value = config.q ?? 0.8
    const gain = audio.createGain()
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(Math.max(config.gain, 0.0002), start + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + config.seconds)
    source.connect(filter).connect(gain).connect(master)
    source.start(start, rng())
    source.stop(start + config.seconds + 0.05)
  }

  // the game `sfx`: lowpass noise, gain set at once and an exponential fall to 0.001 (jogo.js L62097-L62110)
  const classBurst = (at: number, cutoff: number, gain: number, seconds: number): void => {
    const audio = ready()
    if (!audio || !noise || !master) return
    const start = audio.currentTime + at
    const source = audio.createBufferSource()
    source.buffer = noise
    const filter = audio.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = cutoff
    const envelope = audio.createGain()
    envelope.gain.setValueAtTime(gain, start)
    envelope.gain.exponentialRampToValueAtTime(0.001, start + seconds)
    source.connect(filter).connect(envelope).connect(master)
    source.start(start, rng())
    source.stop(start + seconds + 0.05)
  }

  const tone = (config: { at?: number; seconds: number; gain: number; frequency: number; to?: number; type?: OscillatorType }): void => {
    const audio = ready()
    if (!audio || !master) return
    const start = audio.currentTime + (config.at ?? 0)
    const osc = audio.createOscillator()
    osc.type = config.type ?? 'sine'
    osc.frequency.setValueAtTime(config.frequency, start)
    if (config.to) osc.frequency.exponentialRampToValueAtTime(config.to, start + config.seconds)
    const gain = audio.createGain()
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(Math.max(config.gain, 0.0002), start + 0.003)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + config.seconds)
    osc.connect(gain).connect(master)
    osc.start(start)
    osc.stop(start + config.seconds + 0.05)
  }

  const metal = (at: number, frequency: number, gain: number): void => {
    burst({ at, seconds: 0.05, gain, filter: 'highpass', frequency, q: 2 })
    tone({ at, seconds: 0.04, gain: gain * 0.6, frequency: frequency * 0.6, type: 'square' })
  }

  const play = (soundClass: string, classVolume = 1, distance = 0, at = 0): void => {
    const attenuation = classVolume / (1 + distance * distance * distanceCurve.gainFalloff)
    if (attenuation < distanceCurve.minGain) return
    const [cutoff, gain, seconds] = classes[soundClass] ?? FALLBACK_SOUND_CLASS
    classBurst(at, cutoff / (1 + distance * distanceCurve.cutoffFalloff), gain * attenuation, seconds)
  }

  const step = (entry: SoundStep): void => {
    if (entry.layer === 'metal') metal(entry.at, entry.frequency, entry.gain)
    else if (entry.layer === 'class') play(entry.soundClass, entry.volume, 0, entry.at)
    else burst({ at: entry.at, seconds: 0.09, gain: entry.gain, filter: 'lowpass', frequency: entry.frequency })
  }

  const mechanical = (id: MechanicalSoundId): void => {
    for (const entry of mechanicalTable[id] ?? []) step(entry)
  }

  const shotSound = (input: ShotSoundInput): ShotSound => computeShotSound(input, options)

  return {
    shot(energyJ, category, extras = {}) {
      const sound = shotSound({ ...extras, energyJ, category })
      if (!sound.audible) return
      classBurst(0, sound.cutoff, sound.gain, sound.duration)
      if (sound.crack.gain > 0) burst({ seconds: sound.crack.duration, gain: sound.crack.gain, filter: 'highpass', frequency: sound.crack.cutoff })
      tone({ seconds: sound.body.duration, gain: sound.body.gain, frequency: sound.body.frequency, to: sound.body.to })
    },
    shotSound,
    click() {
      mechanical('dry_fire')
    },
    mechanical,
    event(event) {
      const id = mechanicalSoundOf(event)
      if (id) mechanical(id)
    },
    play(soundClass, classVolume, distance) {
      play(soundClass, classVolume, distance)
    },
    reloadStart(category) {
      metal(0, 1500, 0.35)
      if (category !== 'shotgun' && category !== 'revolver') metal(0.12, 900, 0.2)
    },
    reloadEnd(category) {
      metal(0, 1100, 0.45)
      if (category !== 'revolver') metal(0.18, 1900, 0.4)
    },
    cycle() {
      mechanical('cycle')
    },
    clink() {
      const f = 3200 + rng() * 2000
      tone({ seconds: 0.09, gain: 0.12, frequency: f })
      tone({ seconds: 0.06, gain: 0.06, frequency: f * 2.7 })
    },
    thud() {
      burst({ seconds: 0.09, gain: 0.35, filter: 'lowpass', frequency: 380 })
    },
    setVolume(next) {
      level = Math.max(0, Math.min(1, next))
      if (master) master.gain.value = level
    },
    dispose() {
      void ctx?.close()
      ctx = null
      master = null
      noise = null
    },
  }
}
