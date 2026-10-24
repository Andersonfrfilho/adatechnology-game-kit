// The sounds of materials breaking, as recipes of @adatechnology/game-audio. The art scene's `sfx.*` (cena L1354-L1367) are ported literally: the same
// filters, frequencies, lengths, volumes and reverb sends, and the same random numbers drawn in the same order, so a recipe leaves the trace of the team
// code. The game's `boom` (jogo L68278) is here too, as the game's explosion.
import { DISTANCE_CURVES } from '@adatechnology/game-audio'
import type { Layer, LoopRecipe, ParamRef, Range, SoundBank, SoundRecipe } from '@adatechnology/game-audio'

const ATTACK = 0.002

type Length = number | readonly [number, number] | ParamRef

// the layer is `attack + d` long (the art scene's gain rises over `a` and falls over `d`)
const lengthOf = (d: Length, attack: number): Range => {
  if (typeof d === 'number') return attack + d
  if (Array.isArray(d)) return [attack + d[0], attack + d[1]] as const
  return { ...(d as ParamRef), add: ((d as ParamRef).add ?? 0) + attack }
}

const envelope = (attack: number): Layer['envelope'] => [
  [0, 0.0001, 'set', 'fixed'],
  [attack, 1, 'exp'],
  ['1d', 0.0001, 'exp', 'fixed'],
]

type Noise = {
  readonly type?: BiquadFilterType
  readonly f: Range
  /** The filter slides here over `d` (needs a fixed `d`). */
  readonly f2?: number
  readonly q?: number
  readonly a?: number
  readonly d: Length
  readonly vol: Range
  readonly wet?: number
  readonly delay?: Range
}

/** `sNoise` (cena L1323): noise from a random point, a filter (default lowpass, Q 0.7), the gain rising over `a` and falling over `d`. */
export function noise(o: Noise): Layer {
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

type Tone = { readonly wave?: OscillatorType; readonly f: Range; readonly f2?: number; readonly d: Length; readonly vol: Range; readonly wet?: number; readonly delay?: Range }

/** `sTone` (cena L1324): an oscillator sliding from `f` to `f2` (back to `f` when none), the gain rising over 0.002 s and falling over `d`. */
export function tone(o: Tone): Layer {
  return {
    source: { kind: 'osc', wave: o.wave ?? 'sine', frequency: { from: o.f, to: o.f2 ?? 'from', curve: 'exp', over: 'duration' } },
    duration: lengthOf(o.d, ATTACK),
    gain: o.vol,
    ...(o.delay === undefined ? {} : { at: o.delay }),
    ...(o.wet === undefined ? {} : { wet: o.wet }),
    envelope: envelope(ATTACK),
  }
}

const many = (count: number, make: () => Layer): Layer[] => Array.from({ length: count }, make)

const scene = (id: string, layers: readonly Layer[], line: string, vars?: SoundRecipe['vars']): SoundRecipe => ({
  id,
  bus: 'world',
  pan: true,
  layers,
  falloff: DISTANCE_CURVES.art_scene,
  ...(vars ? { vars } : {}),
  sources: [`cena:${line}`],
})

const boomLayers = (big: boolean): Layer[] => [
  noise({ f: 1200, f2: 120, d: 1.8, vol: 2, wet: 1.2 }),
  tone({ f: 65, f2: 24, d: 1.0, vol: 1.8 }),
  noise({ type: 'highpass', f: 1500, d: 0.2, vol: 0.8 }),
  ...(big ? [noise({ f: 500, f2: 90, a: 0.2, d: 2.4, vol: 1.2, wet: 1, delay: 0.15 })] : []),
  ...many(8, () => tone({ f: [2600, 5600], d: 0.05, vol: 0.08, delay: [0.4, 1.6] })),
]

/** The art scene's destruction sounds, each with the team name in its `sources`. */
export const SCENE_SOUNDS: readonly SoundRecipe[] = [
  scene(
    'glass_shatter',
    [noise({ type: 'highpass', f: 2800, d: 0.45, vol: 0.9, wet: 0.5 }), ...many(12, () => tone({ f: [3000, 7500], d: [0.06, 0.14], vol: 0.18, delay: [0, 0.55] }))],
    'L1359 glass',
  ),
  scene(
    'wood_hit',
    [noise({ type: 'bandpass', f: 850, q: 1, d: 0.25, vol: 0.9, wet: 0.3 }), tone({ f: 210, f2: 90, d: 0.1, vol: 0.6 }), noise({ type: 'highpass', f: 2000, d: 0.04, vol: 0.5 })],
    'L1360 wood',
  ),
  scene('thunk', [noise({ type: 'bandpass', f: 700, q: 2, d: 0.07, vol: 0.4 })], 'L1361 thunk'),
  scene('ping', [tone({ f: [2600, 3500], f2: 1400, d: 0.14, vol: 0.18, wet: 0.3 })], 'L1362 ping'),
  scene('clang', [tone({ f: [520, 720], f2: 480, d: 0.5, vol: 0.35, wet: 0.4 }), tone({ f: 1370, f2: 1300, d: 0.3, vol: 0.15 }), noise({ type: 'highpass', f: 2000, d: 0.05, vol: 0.5 })], 'L1363 clang'),
  scene('chip', [noise({ type: 'bandpass', f: 1600, q: 1.2, d: 0.06, vol: 0.5 })], 'L1364 chip'),
  scene(
    'crumble',
    [noise({ f: 900, f2: 200, d: 0.6, vol: 0.9, wet: 0.3 }), ...many(5, () => noise({ type: 'bandpass', f: [500, 1400], q: 2, d: 0.05, vol: 0.4, delay: [0.1, 0.5] }))],
    'L1365 crumble',
  ),
  // `thud(x, z, v)`: `v` is the `scale` param (default 1)
  scene('thud', [tone({ f: 75, f2: 38, d: 0.22, vol: { param: 'scale', scale: 0.6 } }), noise({ f: 420, d: 0.16, vol: { param: 'scale', scale: 0.45 } })], 'L1358 thud', { scale: 1 }),
  // `hiss(x, z, d)`: `seconds` is the param `d` (default 1.2)
  scene('hiss', [noise({ type: 'highpass', f: 3500, a: 0.05, d: { param: 'seconds' }, vol: 0.35 })], 'L1366 hiss', { seconds: 1.2 }),
  scene('boom', boomLayers(false), 'L1367 boom'),
  scene('boom_big', boomLayers(true), 'L1367 boom (big)'),
  scene('burst', [noise({ f: 700, f2: 120, d: 0.7, vol: 1.4, wet: 0.5 }), noise({ type: 'highpass', f: 3000, a: 0.05, d: 1.2, vol: 0.4, delay: 0.1 })], 'L1357 burst'),
  scene('crack', [noise({ type: 'highpass', f: 1800, d: 0.05, vol: 0.8 }), tone({ f: 420, f2: 180, d: 0.06, vol: 0.4 })], 'L1354 crack'),
]

/** The game's explosion thump: a sine from 70 to 28 Hz over 1.2 s, `1.4 / (1 + d² × 0.002)` (jogo L68278). */
export const EXPLOSION_BOOM: SoundRecipe = {
  id: 'explosion_boom',
  bus: 'world',
  order: 'boom',
  duration: 1.6,
  tail: 0.1,
  layers: [
    {
      source: { kind: 'osc', wave: 'sine', frequency: { from: 70, to: 28, curve: 'exp', over: 1.2 } },
      envelope: [
        [0, 1, 'set'],
        ['1d', 0.001, 'exp', 'fixed'],
      ],
    },
  ],
  falloff: DISTANCE_CURVES.game_boom,
  sources: ['jogo:L68278-68285 boom'],
}

/**
 * The fire loop of the art scene (cena L1316): noise through a 1800 Hz bandpass (Q 0.6) into a gain that starts at 0. The page never raises it, so it is
 * silent there; here `createDestructionSound` raises it while something burns (the level is the kit's, in `fire`).
 */
export const BURN_LOOP: LoopRecipe = {
  id: 'burn_loop',
  bus: 'world',
  order: 'chain_loop',
  source: { kind: 'noise', loop: true },
  filters: { mode: 'serial', bank: [{ type: 'bandpass', frequency: { set: 1800 }, q: 0.6 }] },
  volume: 0,
  sources: ['cena:L1316 fire loop (silent in the page: its gain is never raised)', 'sdk: the level while burning'],
}

export const DESTRUCTION_SOUND_BANK: SoundBank = { id: 'destruction_three', sounds: [...SCENE_SOUNDS, EXPLOSION_BOOM], loops: [BURN_LOOP] }
