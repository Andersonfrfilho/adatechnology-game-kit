// Weapon sounds synthesized with WebAudio: no sound files, so the kit stays offline and small. Every call is a no-op where there is no
// AudioContext (tests, workers), and the context is only created on the first sound, which comes from a click or a key (browsers allow it).
// The numbers live in ./audio/*: `computeShotSound` is pure and this file only turns its result into nodes.
import { MIX_PROFILES, createAudioEngine } from '@adatechnology/game-audio'
import type { AudioEngine } from '@adatechnology/game-audio'
import type { WeaponEvent } from '@adatechnology/game-weapons'

import { MECHANICAL_SOUNDS, mechanicalSoundOf } from './audio/mechanical-sounds'
import { BURST_IDS, SCENE_NOISE_IDS, SCENE_TONE_IDS, TONE_IDS, classBurstId, weaponRecipes } from './audio/recipes'
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
  /** Where the AudioContext comes from (default: the global one); lets a host or a test lend its own. Not used with `engine`. */
  readonly createContext?: () => AudioContext
  /**
   * A sound engine the host already has (one shared engine mixes, limits and pans every module the same way). The weapon sounds are registered in it
   * and play on its `weapons` bus; `seed` gives them their own random stream, the master volume and the context stay the engine's. Without it the
   * weapon audio makes its own engine with the game mix, no voice limit, and the master at `volume`.
   */
  readonly engine?: AudioEngine
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

const NOISE_SECONDS = 1.5
const DEFAULT_SEED = 1

type Tone = { at?: number; seconds: number; gain: number; frequency: number; to?: number; type?: OscillatorType }
type Burst = { at?: number; seconds: number; gain: number; filter: BiquadFilterType; frequency: number; q?: number }

export function createWeaponAudio(volume = 0.6, options: WeaponAudioOptions = {}): WeaponAudio {
  const seed = options.seed ?? DEFAULT_SEED
  const classes: Readonly<Record<string, SoundClassDef>> = { ...GAME_SOUND_CLASSES, ...options.classes }
  const distanceCurve = { ...GAME_DISTANCE_CURVE, ...options.distance }
  const mechanicalTable = { ...MECHANICAL_SOUNDS, ...options.mechanical }
  const shared = options.engine
  // own engine: the game mix at the given volume, noise made with the chain, and no voice limit (these sounds are short and the old audio had none)
  const engine: AudioEngine =
    shared ??
    createAudioEngine({
      seed,
      mix: { ...MIX_PROFILES.game!, master: volume, noise: { seconds: NOISE_SECONDS, create: 'eager' } },
      maxVoices: Number.POSITIVE_INFINITY,
      ...(options.createContext ? { createContext: options.createContext } : {}),
    })
  // an own engine draws everything from its one stream (noise first, then the start points), as the old audio did; a shared one gets a stream per module
  const channel = shared && options.seed !== undefined ? shared.channel({ seed }) : engine.channel({})
  engine.register({ id: `weapons_three@${classBurstId(distanceCurve)}`, sounds: weaponRecipes(distanceCurve) })
  const classBurst = classBurstId(distanceCurve)

  // a filtered noise burst with a fast attack and an exponential tail
  const burst = (config: Burst): void => {
    const id = config.filter === 'highpass' ? BURST_IDS.highpass : BURST_IDS.lowpass
    const params = { frequency: config.frequency, q: config.q ?? 0.8, gain: Math.max(config.gain, 0.0002), seconds: config.seconds }
    channel.play(id, { params, ...(config.at ? { delay: config.at } : {}) })
  }

  // the game `sfx`: lowpass noise, gain set at once and an exponential fall to 0.001 (jogo.js L62097-L62110)
  const classBurstAt = (at: number, cutoff: number, gain: number, seconds: number): void => {
    channel.play(classBurst, { params: { cutoff, gain, seconds }, ...(at ? { delay: at } : {}) })
  }

  const tone = (config: Tone): void => {
    const id = config.to ? TONE_IDS.sine_sweep : config.type === 'square' ? TONE_IDS.square : TONE_IDS.sine
    const params = { frequency: config.frequency, gain: Math.max(config.gain, 0.0002), seconds: config.seconds, ...(config.to ? { to: config.to } : {}) }
    channel.play(id, { params, ...(config.at ? { delay: config.at } : {}) })
  }

  const metal = (at: number, frequency: number, gain: number): void => {
    burst({ at, seconds: 0.05, gain, filter: 'highpass', frequency, q: 2 })
    tone({ at, seconds: 0.04, gain: gain * 0.6, frequency: frequency * 0.6, type: 'square' })
  }

  const play = (soundClass: string, classVolume = 1, distance = 0, at = 0): void => {
    const [cutoff, gain, seconds] = classes[soundClass] ?? FALLBACK_SOUND_CLASS
    // the distance goes through the engine's curve (gain / (1 + d² k), cutoff / (1 + d c), silent below minGain)
    channel.play(classBurst, { volume: classVolume, distance, params: { cutoff, gain, seconds }, ...(at ? { delay: at } : {}) })
  }

  // the art scene's sTone and sNoise, heard at the listener
  const sceneTone = (entry: Extract<SoundStep, { layer: 'scene_tone' }>): void => {
    channel.play(SCENE_TONE_IDS[entry.wave], { params: { f: entry.f, f2: entry.f2 ?? entry.f, d: entry.d, vol: entry.vol }, ...(entry.at ? { delay: entry.at } : {}) })
  }
  const sceneNoise = (entry: Extract<SoundStep, { layer: 'scene_noise' }>): void => {
    const slide = entry.f2 !== undefined
    const id = slide ? `${SCENE_NOISE_IDS[entry.type]}_slide` : SCENE_NOISE_IDS[entry.type]
    channel.play(id, { params: { f: entry.f, ...(slide ? { f2: entry.f2 } : {}), q: entry.q, d: entry.d, vol: entry.vol }, ...(entry.at ? { delay: entry.at } : {}) })
  }

  const step = (entry: SoundStep): void => {
    if (entry.layer === 'metal') metal(entry.at, entry.frequency, entry.gain)
    else if (entry.layer === 'scene_tone') sceneTone(entry)
    else if (entry.layer === 'scene_noise') sceneNoise(entry)
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
      classBurstAt(0, sound.cutoff, sound.gain, sound.duration)
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
      // the art scene's `casing` (cena L1344): one ring at 4200-5700 Hz sliding to 3800, 0.25-0.45 s after the case leaves
      const f = 4200 + channel.random() * 1500
      const at = 0.25 + channel.random() * 0.2
      sceneTone({ layer: 'scene_tone', at, wave: 'sine', f, f2: 3800, d: 0.06, vol: 0.06 })
    },
    thud() {
      burst({ seconds: 0.09, gain: 0.35, filter: 'lowpass', frequency: 380 })
    },
    setVolume(next) {
      const level = Math.max(0, Math.min(1, next))
      // a shared engine keeps its master: the weapons bus takes the volume
      if (shared) shared.setBus('weapons', { gain: level })
      else engine.setMaster(level)
    },
    dispose() {
      if (!shared) engine.dispose()
    },
  }
}
