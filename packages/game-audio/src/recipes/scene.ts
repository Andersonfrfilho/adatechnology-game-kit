// The art scene's synthesis primitives (cena L1322-L1328) as recipe layers, shared by every subject bank that ports a `sfx.*` of the page: the
// materials in `destruction-three`, the voices and wounds in `characters-three`. Each helper writes the layer the team routine builds, with its
// fields in the order the routine draws its random numbers, so a recipe built from them leaves the trace of the team code.
import { DISTANCE_CURVES } from '../falloff'
import type { BusId, Envelope, Layer, ParamRef, Range, SoundRecipe } from '../recipe'

const ATTACK = 0.002

/** A length in seconds: a number, a `[min, max]` range or a named number. */
export type SceneLength = number | readonly [number, number] | ParamRef

// the layer is `attack + d` long (the art scene's gain rises over `a` and falls over `d`)
function lengthOf(d: SceneLength, attack: number): Range {
  if (typeof d === 'number') return attack + d
  if (Array.isArray(d)) return [attack + d[0], attack + d[1]] as const
  return { ...(d as ParamRef), add: ((d as ParamRef).add ?? 0) + attack }
}

const envelope = (attack: number): Envelope => [
  [0, 0.0001, 'set', 'fixed'],
  [attack, 1, 'exp'],
  ['1d', 0.0001, 'exp', 'fixed'],
]

export type SceneNoise = {
  readonly type?: BiquadFilterType
  readonly f: Range
  /** The filter slides here over `d` (needs a fixed `d`). */
  readonly f2?: number
  readonly q?: number
  readonly a?: number
  readonly d: SceneLength
  readonly vol: Range
  readonly wet?: number
  readonly delay?: Range
}

/** `sNoise` (cena L1323): noise from a random point, a filter (default lowpass, Q 0.7), the gain rising over `a` and falling over `d`. */
export function sceneNoise(o: SceneNoise): Layer {
  const a = o.a ?? ATTACK
  const over = typeof o.d === 'number' ? o.d : 0
  return {
    filters: {
      mode: 'serial',
      bank: [{ type: o.type ?? 'lowpass', frequency: o.f2 === undefined ? { set: o.f } : { set: o.f, to: o.f2, curve: 'exp', over }, q: o.q ?? 0.7 }],
    },
    duration: lengthOf(o.d, a),
    gain: o.vol,
    ...(o.delay === undefined ? {} : { at: o.delay }),
    ...(o.wet === undefined ? {} : { wet: o.wet }),
    source: { kind: 'noise', offset: 'random', offsetScale: 1.5, loop: true },
    envelope: envelope(a),
  }
}

export type SceneTone = { readonly wave?: OscillatorType; readonly f: Range; readonly f2?: number; readonly d: SceneLength; readonly vol: Range; readonly wet?: number; readonly delay?: Range }

/** `sTone` (cena L1324): an oscillator sliding from `f` to `f2` (back to `f` when none), the gain rising over 0.002 s and falling over `d`. */
export function sceneTone(o: SceneTone): Layer {
  return {
    source: { kind: 'osc', wave: o.wave ?? 'sine', frequency: { from: o.f, to: o.f2 ?? 'from', curve: 'exp', over: 'duration' } },
    duration: lengthOf(o.d, ATTACK),
    gain: o.vol,
    ...(o.delay === undefined ? {} : { at: o.delay }),
    ...(o.wet === undefined ? {} : { wet: o.wet }),
    envelope: envelope(ATTACK),
  }
}

export type SceneVoice = {
  /** Start and end frequency of the sweep (the page ramps linearly from `f0` to `f1` over the length). */
  readonly f0: Range
  readonly f1: Range
  /** Length in seconds. */
  readonly d: SceneLength
  /** Centre of the first and second formant (Q 4 and 6) and of the breath band (Q 1.1). */
  readonly fA: Range
  readonly fB: Range
  /** Level of the breath noise. */
  readonly noise: Range
  readonly vol: Range
  readonly wave?: OscillatorType
}

/**
 * `voice` (cena L1325): an oscillator swept from `f0` to `f1` with a vibrato of 4 to 10 Hz (depth 0.08 of `f0`) through two formant bands plus a band of
 * breath noise, summed and boosted 3.2 times, the gain rising over 0.1 s, held to 0.6 of the length and falling; reverb send 0.45. It is the one
 * layer the page builds with `voice(...)`, so a scream is two of them.
 */
export function sceneVoice(o: SceneVoice): Layer {
  return {
    duration: lengthOf(o.d, 0),
    gain: o.vol,
    wet: 0.45,
    source: {
      kind: 'formant_voice',
      wave: o.wave ?? 'sawtooth',
      frequency: { from: o.f0, to: o.f1, curve: 'linear', over: 'duration' },
      vibrato: { rate: [4, 10], depth: 0.08 },
      formants: [
        { frequency: o.fA, q: 4 },
        { frequency: o.fB, q: 6 },
      ],
      breath: { frequency: o.fB, q: 1.1, gain: o.noise },
      mix: 3.2,
    },
    envelope: [
      [0, 0.0001, 'set', 'fixed'],
      [0.1, 1, 'exp'],
      ['0.6d', 1, 'set'],
      ['1d', 0.0001, 'exp', 'fixed'],
    ],
  }
}

/** The layer played `count` times (a team `for` loop whose body draws numbers): each pass is its own layer, so the draws stay in the loop's order. */
export const sceneMany = (count: number, make: () => Layer): Layer[] => Array.from({ length: count }, make)

export type SceneRecipeOptions = {
  /** Named numbers drawn first (`PlayOptions.params` can override them). */
  readonly vars?: SoundRecipe['vars']
  readonly bus?: BusId
  readonly group?: string
}

/** A recipe in the art scene's mix: positional with the art scene's curve (`vol / (1 + d² × 0.008)`) and pan; `line` is the team code it comes from (`cena:<line>`). */
export function sceneRecipe(id: string, layers: readonly Layer[], line: string, options: SceneRecipeOptions = {}): SoundRecipe {
  return {
    id,
    bus: options.bus ?? 'world',
    pan: true,
    layers,
    falloff: DISTANCE_CURVES.art_scene,
    ...(options.vars ? { vars: options.vars } : {}),
    ...(options.group ? { group: options.group } : {}),
    sources: [`cena:${line}`],
  }
}
