// Weapon sounds synthesized with WebAudio: no sound files, so the kit stays offline and small. Every call is a no-op where there is no
// AudioContext (tests, workers), and the context is only created on the first sound, which comes from a click or a key (browsers allow it).
// The numbers live in ./audio/*: `computeShotSound` is pure and this file only turns its result into nodes.
import { warnOnce } from '@adatechnology/game-contracts'
import { MIX_PROFILES, createAudioEngine } from '@adatechnology/game-audio'
import type { AudioEngine } from '@adatechnology/game-audio'
import type { WeaponEvent } from '@adatechnology/game-weapons'

import { MECHANICAL_SOUNDS, mechanicalSoundOf } from './audio/mechanical-sounds'
import { BURST_IDS, GUNSHOT_IDS, SCENE_NOISE_IDS, SCENE_TONE_IDS, TONE_IDS, classBurstId, weaponRecipes } from './audio/recipes'
import { computeGunshot, pickTake } from './audio/gunshot'
import { computeCasingSound } from './audio/casing-sound'
import { computeFlyby } from './audio/flyby'
import type { FlybyInput, FlybyVoice } from './audio/flyby'
import type { CasingInput, CasingSound, CasingVoice } from './audio/casing-sound'
import type { Gunshot, GunshotInput, GunshotOptions, GunshotSpace, GunshotVoice } from './audio/gunshot'
import type { MechanicalSoundId, SoundStep } from './audio/mechanical-sounds'
import { RELOAD_CUES, reloadCueSteps } from './audio/reload-sounds'
import type { SoundProfile } from './audio/reload-sounds'
import { computeShotSound, FALLBACK_SOUND_CLASS, GAME_DISTANCE_CURVE, GAME_SOUND_CLASSES } from './audio/shot-sound'
import type { ShotSound, ShotSoundInput, ShotSoundOptions, SoundClassDef } from './audio/shot-sound'

export { computeShotSound, GAME_SOUND_CLASSES, GAME_DISTANCE_CURVE, DEFAULT_ENERGY_CURVE, CLASS_REFERENCE_ENERGY } from './audio/shot-sound'
export type { ShotSound, ShotSoundInput, ShotSoundOptions, ShotSoundClass, SoundClassDef, DistanceCurve, EnergyCurve } from './audio/shot-sound'
export { computeGunshot, gunshotProfileOf, pickTake, energyOfGunshot, GUNSHOT_PROFILES, GUNSHOT_CALIBER_PROFILES, GUNSHOT_TAKES, SPEED_OF_SOUND } from './audio/gunshot'
export type { Gunshot, GunshotInput, GunshotOptions, GunshotProfile, GunshotProfileId, GunshotFarClass, GunshotSpace, GunshotGroup, GunshotVoice } from './audio/gunshot'
export { computeFlyby } from './audio/flyby'
export type { FlybyInput, FlybySound, FlybyVoice } from './audio/flyby'
export { computeCasingSound, casingSurfaceOf, casingKindOf } from './audio/casing-sound'
export type { CasingInput, CasingSound, CasingVoice, CasingSurface, CasingKind } from './audio/casing-sound'
export { MECHANICAL_SOUNDS, mechanicalSoundOf } from './audio/mechanical-sounds'
export type { MechanicalSoundId, SoundStep } from './audio/mechanical-sounds'
export { RELOAD_CUES, RELOAD_CUE_IDS, DEFAULT_SOUND_PROFILE, reloadCueSteps, soundProfileOf } from './audio/reload-sounds'
export type { ReloadCueId, SoundProfile } from './audio/reload-sounds'

/** What a shot adds to the energy and the category: where the listener is and how the weapon is set. */
export type ShotExtras = Pick<ShotSoundInput, 'caliber' | 'distance' | 'volume' | 'suppressed' | 'indoors'> & {
  /** Where the shot is, for the stereo side (the engine's listener is the other end). Left out, the shot is in front (the player's own weapon). */
  readonly position?: readonly [number, number, number]
  /** 0..1, a wall between the shot and the listener (the host's occlusion test): quieter and duller. */
  readonly occlusion?: number
  /** Open field or a room; `indoors: true` means `'indoor'`. Default outdoor. */
  readonly space?: GunshotSpace
}

/** `gunshot` (default): the layered shot of `computeGunshot`. `game`: the game's single class burst (`computeShotSound`), kept for the golden traces. */
export type ShotModel = 'gunshot' | 'game'

export interface WeaponAudioOptions extends ShotSoundOptions {
  /** How a shot is built; default `gunshot`. */
  readonly shotModel?: ShotModel
  /** Tunes the layered gunshot (profiles, calibre links, distance law). */
  readonly gunshot?: GunshotOptions
  /** Pitch spread of a shot, ± this fraction (default 0.04, C5). */
  readonly pitchSpread?: number
  /** Told each gunshot played (profile, take, pitch, space, distance), so a host can log what sounded. */
  readonly onGunshot?: (shot: Gunshot, input: GunshotInput) => void
  /** Told each case that lands (floor, case type, sample id). */
  readonly onCasing?: (sound: CasingSound) => void
  /** Seed of the noise buffer, of the start point in it and of the casing pitch: same seed, same sound. Default 1. */
  readonly seed?: number
  /** Replaces or adds mechanical sounds by id. */
  readonly mechanical?: Readonly<Partial<Record<MechanicalSoundId, readonly SoundStep[]>>>
  /** Replaces or adds the sounds of the reload clip cues by id (`reload-sounds.json` has the ones the kit ships). */
  readonly reloadCues?: Readonly<Record<string, readonly SoundStep[]>>
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
  /** A shot: the layered gunshot of its calibre (close, action, room or field, far) at its distance, or the game's class burst with `shotModel: 'game'`. */
  shot(energyJ: number, category: string, extras?: ShotExtras): void
  /** The parameters `shot` would play with the `game` model (pure). */
  shotSound(input: ShotSoundInput): ShotSound
  /** The voices `shot` plays with the `gunshot` model (pure; give `take` and `pitch` to fix them). */
  gunshot(input: GunshotInput): Gunshot
  /** Dry click of an empty weapon. */
  click(): void
  /** A mechanical sound by id: a reload stage, `dry_fire`, `jam`, `safety_on`... */
  mechanical(id: MechanicalSoundId): void
  /** A cue of a reload clip (`mag_seat`, `charging_handle_pull`, `pump_back`...) for a weapon's profile (the weight of its metal and what it is made of): played now, where the clip says. */
  cue(id: string, profile?: SoundProfile): void
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
  /** A casing bouncing on the floor (the art scene's single ring; with the `gunshot` model, a pistol case on concrete). */
  clink(): void
  /** A case hitting the floor: its type (pistol, rifle, shell), the floor material, the speed and which bounce. */
  casing(input: CasingInput): void
  /** A bullet passing the listener (shot by someone else): crack when supersonic, whiz when not; `position` is where it passes, for the side. */
  flyby(input: FlybyInput & { readonly position?: readonly [number, number, number] }): void
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
  const cueTable = { ...RELOAD_CUES, ...options.reloadCues }
  const shared = options.engine
  if (!shared) warnOnce('game-weapons-three.own-audio-engine', 'game-weapons-three made an audio engine of its own because the host lent none (options.engine); pass the host engine so the sounds share one mix and one voice limit')
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
  const gunshot = (input: GunshotInput): Gunshot => computeGunshot(input, options.gunshot)
  const playCasingVoice = (voice: CasingVoice | FlybyVoice, position?: readonly [number, number, number]): void => {
    const id = voice.kind === 'tone' ? GUNSHOT_IDS.tone : GUNSHOT_IDS[voice.filter ?? 'lowpass']
    const params: Record<string, number> = voice.kind === 'tone' ? { frequency: voice.frequency, to: voice.to ?? voice.frequency, gain: voice.gain, seconds: voice.seconds } : { frequency: voice.frequency, q: voice.q ?? 0.7, gain: voice.gain, seconds: voice.seconds }
    channel.play(id, { params, ...(position ? { position: [position[0], position[1], position[2]] as [number, number, number] } : {}) })
  }
  const casing = (input: CasingInput): void => {
    const sound = computeCasingSound({ ...input, pitch: input.pitch ?? 1 + (channel.random() * 2 - 1) * 0.06 })
    for (const voice of sound.voices) playCasingVoice(voice)
    options.onCasing?.(sound)
  }
  const lastTake = new Map<string, number>()
  const pitchSpread = options.pitchSpread ?? 0.04
  const playGunshotVoice = (voice: GunshotVoice, extras: ShotExtras): void => {
    const id = voice.kind === 'tone' ? GUNSHOT_IDS.tone : voice.wet ? GUNSHOT_IDS.lowpass_wet : GUNSHOT_IDS[voice.filter ?? 'lowpass']
    const params: Record<string, number> = voice.kind === 'tone' ? { frequency: voice.frequency, to: voice.to ?? voice.frequency, gain: voice.gain, seconds: voice.seconds } : { frequency: voice.frequency, q: voice.q ?? 0.7, gain: voice.gain, seconds: voice.seconds }
    channel.play(id, {
      params,
      ...(voice.at > 0 ? { delay: voice.at } : {}),
      ...(extras.position ? { position: [extras.position[0], extras.position[1], extras.position[2]] as [number, number, number] } : {}),
    })
  }

  return {
    shot(energyJ, category, extras = {}) {
      if (options.shotModel !== 'game') {
        const base: GunshotInput = { energyJ, category, ...extras, space: extras.space ?? (extras.indoors ? 'indoor' : 'outdoor') }
        const profile = computeGunshot(base, options.gunshot).profile
        const take = pickTake(lastTake.get(profile), channel.random)
        lastTake.set(profile, take)
        const pitch = 1 + (channel.random() * 2 - 1) * pitchSpread
        const shot = computeGunshot({ ...base, take, pitch }, options.gunshot)
        for (const voice of shot.voices) playGunshotVoice(voice, extras)
        if (shot.audible) options.onGunshot?.(shot, { ...base, take, pitch })
        return
      }
      const sound = shotSound({ ...extras, energyJ, category })
      if (!sound.audible) return
      classBurstAt(0, sound.cutoff, sound.gain, sound.duration)
      if (sound.crack.gain > 0) burst({ seconds: sound.crack.duration, gain: sound.crack.gain, filter: 'highpass', frequency: sound.crack.cutoff })
      tone({ seconds: sound.body.duration, gain: sound.body.gain, frequency: sound.body.frequency, to: sound.body.to })
    },
    shotSound,
    gunshot,
    click() {
      mechanical('dry_fire')
    },
    mechanical,
    cue(id, profile) {
      for (const entry of reloadCueSteps(id, profile, cueTable)) step(entry)
    },
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
    casing,
    flyby(input) {
      const sound = computeFlyby({ ...input, pitch: input.pitch ?? 1 + (channel.random() * 2 - 1) * 0.05 })
      for (const voice of sound?.voices ?? []) playCasingVoice(voice, input.position)
    },
    clink() {
      if (options.shotModel !== 'game') {
        casing({})
        return
      }
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
