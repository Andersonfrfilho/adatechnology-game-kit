// The sounds of materials breaking, as recipes of @adatechnology/game-audio. The art scene's `sfx.*` (cena L1354-L1367) are ported literally: the same
// filters, frequencies, lengths, volumes and reverb sends, and the same random numbers drawn in the same order, so a recipe leaves the trace of the team
// code. The game's `boom` (jogo L68278) is here too, as the game's explosion.
import { DISTANCE_CURVES, sceneMany as many, sceneNoise as noise, sceneRecipe, sceneTone as tone } from '@adatechnology/game-audio'
import type { Layer, LoopRecipe, SoundBank, SoundRecipe } from '@adatechnology/game-audio'

const scene = (id: string, layers: readonly Layer[], line: string, vars?: SoundRecipe['vars']): SoundRecipe => sceneRecipe(id, layers, line, vars ? { vars } : {})

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

const drag = (id: string, layers: readonly Layer[]): SoundRecipe => ({ ...sceneRecipe(id, layers, ''), sources: ['sdk: a base dragged on a floor, one grain per stretch'] })

/** Something heavy dragged on a floor, by what its base is made of. */
export const DRAG_SOUNDS: readonly SoundRecipe[] = [
  drag('drag_wood', [noise({ type: 'bandpass', f: 380, q: 1.4, d: 0.28, vol: 0.5 }), noise({ type: 'bandpass', f: [900, 1300], q: 3, d: 0.08, vol: 0.14 })]),
  drag('drag_metal', [noise({ type: 'bandpass', f: 1500, q: 4, d: 0.26, vol: 0.32 }), tone({ f: [880, 1240], f2: 760, d: 0.18, vol: 0.05 })]),
  drag('drag_glass', [noise({ type: 'bandpass', f: 2600, q: 5, d: 0.2, vol: 0.22 })]),
  drag('drag_masonry', [noise({ type: 'bandpass', f: 260, q: 0.9, d: 0.3, vol: 0.62 }), ...many(3, () => noise({ type: 'bandpass', f: [600, 1200], q: 2, d: 0.04, vol: 0.14, delay: [0, 0.2] }))]),
  drag('drag_soft', [noise({ type: 'lowpass', f: 420, d: 0.28, vol: 0.3 })]),
]

export const DESTRUCTION_SOUND_BANK: SoundBank = { id: 'destruction_three', sounds: [...SCENE_SOUNDS, ...DRAG_SOUNDS, EXPLOSION_BOOM], loops: [BURN_LOOP] }
