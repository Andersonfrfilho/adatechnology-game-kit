import { muzzleEnergy } from '@adatechnology/game-weapons'
import type { CaliberDef } from '@adatechnology/game-weapons'

/** One sound of the game: [lowpass cutoff Hz, gain, seconds]. Literal from the `P` table of `sfx` in the game (jogo.js L62101-L62104). */
export type SoundClassDef = readonly [cutoff: number, gain: number, seconds: number]

/** The game names are pistola, escopeta, fuzil, rifle, impacto, carne, passo, vidro, madeira, recarga, vazio and explosao. */
export const GAME_SOUND_CLASSES = {
  pistol: [1800, 0.9, 0.18],
  shotgun: [900, 1.2, 0.35],
  rifle: [1400, 1.1, 0.28],
  long_rifle: [1100, 1.3, 0.45],
  impact: [2500, 0.25, 0.05],
  flesh: [600, 0.35, 0.08],
  step: [400, 0.08, 0.05],
  glass: [5000, 0.5, 0.3],
  wood: [700, 0.5, 0.2],
  reload: [3000, 0.15, 0.06],
  empty: [4000, 0.12, 0.03],
  explosion: [200, 1.6, 1.4],
} as const satisfies Record<string, SoundClassDef>

/** `|| [1000, 0.5, 0.1]` of the game (jogo.js L62104), for a class name that is not in the table. */
export const FALLBACK_SOUND_CLASS: SoundClassDef = [1000, 0.5, 0.1]

/** The four classes a shot can have: the game picks one by calibre (jogo.js L68697). */
export type ShotSoundClass = 'pistol' | 'shotgun' | 'rifle' | 'long_rifle'

/** Distance muffling of the game (jogo.js L62092, L62105): `gain / (1 + d² × gainFalloff)`, `cutoff / (1 + d × cutoffFalloff)`, silent under `minGain`. */
export type DistanceCurve = { readonly gainFalloff: number; readonly cutoffFalloff: number; readonly minGain: number }
export const GAME_DISTANCE_CURVE: DistanceCurve = { gainFalloff: 0.004, cutoffFalloff: 0.01, minGain: 0.01 }

/**
 * The calibre energy (joules) scales loudness, length and brightness around the class: each factor is `base + span × k`, where k goes from 0 (50 J)
 * to 1 (50 J × 10^spanDecades) on a log scale, divided by the same factor at the class reference energy. So the game calibres sound exactly as in
 * the game, and a lighter or heavier calibre of the same class is quieter and brighter, or louder and duller.
 */
export type EnergyCurve = {
  readonly floorJ: number
  readonly spanDecades: number
  readonly gain: readonly [base: number, span: number]
  readonly duration: readonly [base: number, span: number]
  readonly cutoff: readonly [base: number, span: number]
  /** The muzzle crack (high noise) and the body (low thump) follow the energy alone. */
  readonly crackGain: readonly [base: number, span: number]
  readonly bodyGain: readonly [base: number, span: number]
  readonly bodyDuration: readonly [base: number, span: number]
  readonly bodyFrequency: readonly [base: number, span: number]
}

export const DEFAULT_ENERGY_CURVE: EnergyCurve = {
  floorJ: 50,
  spanDecades: 2.5,
  gain: [0.7, 0.6],
  duration: [0.75, 0.5],
  cutoff: [1.15, -0.3],
  crackGain: [0.3, 0.4],
  bodyGain: [0.35, 0.4],
  bodyDuration: [0.14, 0.2],
  bodyFrequency: [140, -70],
}

/** Muzzle energy of the game calibres in the SDK (9x19, 12ga_00buck × pellets, 7_62x39, 7_62x51): where a class sounds exactly as in the game. */
export const CLASS_REFERENCE_ENERGY: Readonly<Record<ShotSoundClass, number>> = { pistol: 500, shotgun: 2700, rifle: 2100, long_rifle: 3500 }

export type ShotSoundOptions = {
  /** Replaces or adds sound classes (the game table is the default). */
  readonly classes?: Readonly<Record<string, SoundClassDef>>
  readonly distance?: Partial<DistanceCurve>
  readonly energy?: Partial<EnergyCurve>
  readonly referenceEnergy?: Partial<Record<ShotSoundClass, number>>
  /** Picks the class of a shot; the default follows the game (shotgun by shell, handguns by category, then by energy). */
  readonly classOf?: (input: ShotSoundInput, energyJ: number) => ShotSoundClass
  /** Class bands by energy (J): below `handgunBelowJ` a pistol, below `rifleBelowJ` a rifle, above that a long rifle. */
  readonly bands?: { readonly handgunBelowJ: number; readonly rifleBelowJ: number }
  readonly suppressor?: { readonly gain: number; readonly cutoff: number; readonly crack: number; readonly body: number }
  readonly indoors?: { readonly duration: number; readonly cutoff: number }
}

export type ShotSoundInput = {
  /** The calibre; its energy (× pellets) is used unless `energyJ` is given. */
  readonly caliber?: CaliberDef
  readonly energyJ?: number
  readonly category?: string
  /** Metres from the listener, default 0. */
  readonly distance?: number
  /** Master gain of the game `sfx` (its `vol`), default 1. */
  readonly volume?: number
  readonly suppressed?: boolean
  readonly indoors?: boolean
}

export type ShotSound = {
  readonly soundClass: ShotSoundClass
  readonly energyJ: number
  /** False when the shot is under the game's `minGain` at this distance: nothing is played. */
  readonly audible: boolean
  /** The main noise burst: lowpass cutoff Hz, starting gain and the seconds of the exponential tail (to 0.001). */
  readonly cutoff: number
  readonly gain: number
  readonly duration: number
  /** High noise burst of the muzzle. */
  readonly crack: { readonly gain: number; readonly cutoff: number; readonly duration: number }
  /** Low thump that sweeps from `frequency` to `to`. */
  readonly body: { readonly gain: number; readonly frequency: number; readonly to: number; readonly duration: number }
}

const HANDGUN_CATEGORIES: ReadonlySet<string> = new Set(['pistol', 'revolver', 'smg'])
const SHELL_KINDS: ReadonlySet<string> = new Set(['buck', 'slug', 'birdshot'])
const DEFAULT_BANDS = { handgunBelowJ: 1000, rifleBelowJ: 3000 }
const DEFAULT_SUPPRESSOR = { gain: 0.3, cutoff: 0.6, crack: 0, body: 0.5 }
const DEFAULT_INDOORS = { duration: 1.5, cutoff: 0.85 }
const CRACK_CUTOFF = 3000
const CRACK_SECONDS = 0.03
const BODY_TO_FREQUENCY = 40

const linear = ([base, span]: readonly [number, number], k: number): number => base + span * k

const energyPosition = (energyJ: number, curve: EnergyCurve): number =>
  Math.min(1, Math.max(0, Math.log10(Math.max(energyJ, curve.floorJ) / curve.floorJ) / curve.spanDecades))

export const energyOfShot = (input: ShotSoundInput): number => {
  if (input.energyJ !== undefined) return input.energyJ
  if (!input.caliber) return 0
  return muzzleEnergy(input.caliber) * (input.caliber.pellets ?? 1)
}

const defaultClassOf = (input: ShotSoundInput, energyJ: number, bands: { handgunBelowJ: number; rifleBelowJ: number }): ShotSoundClass => {
  if (input.category === 'shotgun' || (input.caliber?.pellets ?? 1) > 1 || SHELL_KINDS.has(input.caliber?.kind ?? '')) return 'shotgun'
  if (input.category && HANDGUN_CATEGORIES.has(input.category)) return 'pistol'
  if (energyJ < bands.handgunBelowJ) return 'pistol'
  return energyJ < bands.rifleBelowJ ? 'rifle' : 'long_rifle'
}

/**
 * The parameters of a gunshot, without WebAudio: the sound class and the distance muffling of the game (S2) with the calibre energy of the SDK.
 * Pure and deterministic; the playback layer only turns it into nodes.
 */
export const computeShotSound = (input: ShotSoundInput, options: ShotSoundOptions = {}): ShotSound => {
  const curve: EnergyCurve = { ...DEFAULT_ENERGY_CURVE, ...options.energy }
  const distanceCurve: DistanceCurve = { ...GAME_DISTANCE_CURVE, ...options.distance }
  const energyJ = energyOfShot(input)
  const soundClass = options.classOf ? options.classOf(input, energyJ) : defaultClassOf(input, energyJ, options.bands ?? DEFAULT_BANDS)
  const table: Readonly<Record<string, SoundClassDef>> = { ...GAME_SOUND_CLASSES, ...options.classes }
  const [classCutoff, classGain, classSeconds] = table[soundClass] ?? FALLBACK_SOUND_CLASS
  const referenceEnergy = options.referenceEnergy?.[soundClass] ?? CLASS_REFERENCE_ENERGY[soundClass] ?? energyJ

  const k = energyPosition(energyJ, curve)
  const referenceK = energyPosition(referenceEnergy, curve)
  const distance = Math.max(0, input.distance ?? 0)
  const attenuation = (input.volume ?? 1) / (1 + distance * distance * distanceCurve.gainFalloff)
  const muffling = 1 / (1 + distance * distanceCurve.cutoffFalloff)

  const suppressor = input.suppressed ? { ...DEFAULT_SUPPRESSOR, ...options.suppressor } : { gain: 1, cutoff: 1, crack: 1, body: 1 }
  const indoors = input.indoors ? { ...DEFAULT_INDOORS, ...options.indoors } : { duration: 1, cutoff: 1 }

  const gain = classGain * attenuation * (linear(curve.gain, k) / linear(curve.gain, referenceK)) * suppressor.gain
  const duration = classSeconds * (linear(curve.duration, k) / linear(curve.duration, referenceK)) * indoors.duration
  const cutoff = classCutoff * muffling * (linear(curve.cutoff, k) / linear(curve.cutoff, referenceK)) * suppressor.cutoff * indoors.cutoff

  return {
    soundClass,
    energyJ,
    audible: attenuation >= distanceCurve.minGain,
    cutoff,
    gain,
    duration,
    crack: { gain: linear(curve.crackGain, k) * attenuation * suppressor.crack, cutoff: CRACK_CUTOFF, duration: CRACK_SECONDS },
    body: {
      gain: linear(curve.bodyGain, k) * attenuation * suppressor.body,
      frequency: linear(curve.bodyFrequency, k),
      to: BODY_TO_FREQUENCY,
      duration: linear(curve.bodyDuration, k) * indoors.duration,
    },
  }
}
