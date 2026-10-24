// The weapon sounds as recipes of @adatechnology/game-audio, in the `weapon` build order: a filtered noise burst or a tone, each with its own envelope
// gain. These are the three primitives `createWeaponAudio` was written with (the game's class burst, a free burst and a tone); the numbers that change
// from sound to sound (cutoff, gain, seconds, frequency) are named params the adapter fills in, so a sound class, a mechanical step or a shot are all data.
import type { Layer, SoundRecipe } from '@adatechnology/game-audio'

import { GAME_DISTANCE_CURVE } from './shot-sound'
import type { DistanceCurve } from './shot-sound'

export const CLASS_BURST_ID = 'weapon_class_burst'
export const BURST_IDS = { lowpass: 'weapon_burst_lowpass', highpass: 'weapon_burst_highpass' } as const
export const TONE_IDS = { sine: 'weapon_tone_sine', sine_sweep: 'weapon_tone_sine_sweep', square: 'weapon_tone_square' } as const

const SOURCE_CLASS_BURST = 'jogo:L62097-62110 sfx: lowpass noise, gain set at once, exponential fall to 0.001, stopped 0.05 s later'
const SOURCE_SDK = 'sdk: the weapon synth of weapons-three (burst and tone), moved onto game-audio with the same nodes'
const FIT = { kind: 'noise', offset: 'fit' } as const

/** The id of the class burst for a distance curve: the game's keeps the plain id, another curve is named by its numbers so engines can be shared. */
export function classBurstId(curve: DistanceCurve): string {
  const same = curve.gainFalloff === GAME_DISTANCE_CURVE.gainFalloff && curve.cutoffFalloff === GAME_DISTANCE_CURVE.cutoffFalloff && curve.minGain === GAME_DISTANCE_CURVE.minGain
  return same ? CLASS_BURST_ID : `${CLASS_BURST_ID}@${curve.gainFalloff},${curve.cutoffFalloff},${curve.minGain}`
}

/** `classBurst`: params `cutoff`, `gain` and `seconds`; the level is `volume / (1 + d² × gainFalloff)` and the cutoff is divided by `1 + d × cutoffFalloff`. */
export function classBurstRecipe(curve: DistanceCurve): SoundRecipe {
  return {
    id: classBurstId(curve),
    bus: 'weapons',
    order: 'weapon',
    duration: { param: 'seconds' },
    layers: [
      {
        gain: { param: 'gain' },
        source: FIT,
        filters: { mode: 'serial', bank: [{ type: 'lowpass', frequency: { set: { param: 'cutoff' } } }] },
        envelope: [
          [0, 1, 'set'],
          ['1d', 0.001, 'exp', 'fixed'],
        ],
      },
    ],
    falloff: { model: 'inverse_square', k: curve.gainFalloff, cutoffK: curve.cutoffFalloff, minGain: curve.minGain },
    sources: [SOURCE_CLASS_BURST],
  }
}

const burstLayer = (type: 'lowpass' | 'highpass'): Layer => ({
  gain: { param: 'gain' },
  source: FIT,
  filters: { mode: 'serial', bank: [{ type, frequency: { set: { param: 'frequency' } }, q: { param: 'q' } }] },
  envelope: [
    [0, 0.0001, 'set', 'fixed'],
    [0.004, 1, 'exp'],
    ['1d', 0.0001, 'exp', 'fixed'],
  ],
})

/** `burst`: params `frequency`, `q`, `gain` and `seconds`; no distance (the caller already folded it in). */
export const burstRecipe = (type: 'lowpass' | 'highpass'): SoundRecipe => ({
  id: BURST_IDS[type],
  bus: 'weapons',
  order: 'weapon',
  duration: { param: 'seconds' },
  layers: [burstLayer(type)],
  falloff: { model: 'none' },
  sources: [SOURCE_SDK],
})

const toneLayer = (wave: OscillatorType, sweep: boolean): Layer => ({
  gain: { param: 'gain' },
  source: { kind: 'osc', wave, frequency: sweep ? { from: { param: 'frequency' }, to: { param: 'to' }, curve: 'exp', over: 'duration' } : { from: { param: 'frequency' } } },
  envelope: [
    [0, 0.0001, 'set', 'fixed'],
    [0.003, 1, 'exp'],
    ['1d', 0.0001, 'exp', 'fixed'],
  ],
})

/** `tone`: params `frequency`, `gain` and `seconds` (and `to` for the sweep). */
export const toneRecipe = (id: string, wave: OscillatorType, sweep: boolean): SoundRecipe => ({
  id,
  bus: 'weapons',
  order: 'weapon',
  duration: { param: 'seconds' },
  layers: [toneLayer(wave, sweep)],
  falloff: { model: 'none' },
  sources: [SOURCE_SDK],
})

/** The recipes of an adapter: the three primitives, with the class burst on the given distance curve. */
export function weaponRecipes(curve: DistanceCurve): SoundRecipe[] {
  return [
    classBurstRecipe(curve),
    burstRecipe('lowpass'),
    burstRecipe('highpass'),
    toneRecipe(TONE_IDS.sine, 'sine', false),
    toneRecipe(TONE_IDS.sine_sweep, 'sine', true),
    toneRecipe(TONE_IDS.square, 'square', false),
  ]
}
