// The sounds of materials breaking, as recipes of @adatechnology/game-audio. The art scene's `sfx.*` (cena L1354-L1367) are ported literally: the same
// filters, frequencies, lengths, volumes and reverb sends, and the same random numbers drawn in the same order, so a recipe leaves the trace of the team
// code. The game's `boom` (jogo L68278) is here too, as the game's explosion.
import { DISTANCE_CURVES, sceneMany as many, sceneNoise as noise, sceneRecipe, sceneTone as tone } from '@adatechnology/game-audio'
import type { Layer, LoopRecipe, SoundBank, SoundRecipe } from '@adatechnology/game-audio'

import { BLAST_SOUNDS, FIRE_FUEL_LOOPS, FIRE_LOOP, FIRE_SOUNDS, GRENADE_PIN_PULL, ROCKET_MOTOR_LOOP, SMOKE_HISS_LOOP } from './blast-fire'

const scene = (id: string, layers: readonly Layer[], line: string, vars?: SoundRecipe['vars'], group?: string): SoundRecipe =>
  sceneRecipe(id, layers, line, { ...(vars ? { vars } : {}), ...(group ? { group } : {}) })

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
  // many parts coming loose at once share the `debris_knock` voices (game-audio voice-groups.json)
  scene('thunk', [noise({ type: 'bandpass', f: 700, q: 2, d: 0.07, vol: 0.4 })], 'L1361 thunk', undefined, 'debris_knock'),
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
  // every melting part shares one `sizzle` voice
  scene('hiss', [noise({ type: 'highpass', f: 3500, a: 0.05, d: { param: 'seconds' }, vol: 0.35 })], 'L1366 hiss', { seconds: 1.2 }, 'sizzle'),
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

const leaf = (id: string, layers: readonly Layer[]): SoundRecipe => ({ ...sceneRecipe(id, layers, ''), sources: ['sdk: a door, lid or drawer worked by hand'] })

/** A leaf worked by hand: the latch, the hinge as it turns (by what the leaf is made of), the leaf meeting its frame, a locked leaf shaken, a drawer on its runners. */
export const LEAF_SOUNDS: readonly SoundRecipe[] = [
  leaf('latch', [noise({ type: 'bandpass', f: 2400, q: 4, d: 0.03, vol: 0.35 }), tone({ f: 1900, f2: 1500, d: 0.025, vol: 0.06, delay: 0.035 })]),
  leaf('creak_wood', [tone({ f: [190, 240], f2: 310, d: 0.5, vol: 0.05 }), noise({ type: 'bandpass', f: 520, q: 6, a: 0.05, d: 0.45, vol: 0.12 })]),
  leaf('creak_metal', [tone({ f: [620, 760], f2: 900, d: 0.35, vol: 0.035 }), noise({ type: 'bandpass', f: 1400, q: 8, a: 0.04, d: 0.3, vol: 0.08 })]),
  leaf('shut_wood', [tone({ f: 120, f2: 60, d: 0.14, vol: 0.5 }), noise({ type: 'bandpass', f: 600, q: 1.2, d: 0.1, vol: 0.55, wet: 0.25 }), noise({ type: 'bandpass', f: 2400, q: 4, d: 0.03, vol: 0.25, delay: 0.02 })]),
  leaf('shut_metal', [tone({ f: 160, f2: 85, d: 0.18, vol: 0.55 }), noise({ type: 'bandpass', f: 900, q: 1.6, d: 0.12, vol: 0.45, wet: 0.3 }), tone({ f: 1250, f2: 1150, d: 0.12, vol: 0.06 })]),
  leaf('shut_soft', [tone({ f: 95, f2: 55, d: 0.12, vol: 0.35 }), noise({ type: 'lowpass', f: 500, d: 0.1, vol: 0.3 })]),
  leaf('rattle', many(5, () => noise({ type: 'bandpass', f: [1600, 2600], q: 3, d: 0.035, vol: 0.32, delay: [0, 0.45] }))),
  leaf('slide', [noise({ type: 'bandpass', f: 700, q: 2, a: 0.04, d: 0.35, vol: 0.22 }), noise({ type: 'bandpass', f: 2200, q: 5, d: 0.3, vol: 0.05 })]),
  // an item taken in the hand: the fingers on a hard surface and the sleeve moving, or a soft thing gathered up (the kit's recordings answer these ids)
  leaf('grab_hard', [noise({ type: 'bandpass', f: 1800, q: 3, d: 0.03, vol: 0.18 }), noise({ type: 'bandpass', f: 900, q: 1.2, a: 0.02, d: 0.14, vol: 0.08 })]),
  leaf('grab_soft', [noise({ type: 'lowpass', f: 1400, a: 0.02, d: 0.16, vol: 0.14 })]),
]

const impact = (id: string, layers: readonly Layer[]): SoundRecipe => ({ ...sceneRecipe(id, layers, ''), sources: ['sdk: a blow on a material, by material and kind of blow (synthesised until the recorded samples arrive)'] })

/**
 * A blow on a material, by what it is made of and what met it (`impactSoundKeys`): a bullet, a blunt blow (a punch, a kick, a fall), a blade. Each
 * is drawn from how the real thing sounds (checklist 5.3): a bullet rings steel and goes "tchak" on concrete with pebbles after it, a fist on steel is a
 * low "bong", a knife scrapes it; the ground is a dull "tuf", ceramic a dry "tic", plastic a hollow "toc", a sofa a "fump". Levels are matched so a
 * bullet on concrete is as loud as on wood.
 */
export const IMPACT_SOUNDS: readonly SoundRecipe[] = [
  // metal
  impact('metal_bullet', [noise({ type: 'highpass', f: 3000, d: 0.03, vol: 0.8 }), tone({ f: [2600, 3400], f2: 1800, d: 0.14, vol: 0.28, wet: 0.35 }), tone({ f: [520, 720], f2: 480, d: 0.35, vol: 0.22, wet: 0.35 })]),
  impact('metal_blunt', [noise({ type: 'bandpass', f: 800, q: 1, d: 0.05, vol: 0.5 }), tone({ f: [150, 210], f2: 120, d: 0.6, vol: 0.5, wet: 0.4 }), tone({ f: [420, 520], f2: 400, d: 0.4, vol: 0.12 })]),
  impact('metal_blade', [noise({ type: 'bandpass', f: [3500, 4500], q: 6, a: 0.01, d: 0.18, vol: 0.45 }), tone({ f: [2200, 2800], f2: 3000, d: 0.15, vol: 0.06 })]),
  impact('metal_ping', [noise({ type: 'highpass', f: 3500, d: 0.02, vol: 0.5 }), tone({ f: [2600, 3500], f2: 1400, d: 0.14, vol: 0.2, wet: 0.3 })]),
  impact('metal_thin', [noise({ type: 'highpass', f: 2500, d: 0.04, vol: 0.6 }), tone({ f: [900, 1300], f2: 700, d: 0.25, vol: 0.22, wet: 0.3 }), noise({ type: 'bandpass', f: 1200, q: 2, d: 0.08, vol: 0.3 })]),
  // wood (the bullet keeps the art scene's `wood_hit`)
  impact('wood_blunt', [tone({ f: [110, 150], f2: 70, d: 0.14, vol: 0.6 }), noise({ type: 'bandpass', f: 500, q: 1.2, d: 0.12, vol: 0.55, wet: 0.2 })]),
  impact('wood_blade', [noise({ type: 'bandpass', f: [1800, 2400], q: 2, a: 0.01, d: 0.12, vol: 0.5 }), ...many(3, () => noise({ type: 'bandpass', f: [2500, 4000], q: 3, d: 0.02, vol: 0.22, delay: [0.02, 0.1] }))]),
  impact('wood_splinter', [noise({ type: 'highpass', f: 1800, d: 0.05, vol: 0.6 }), tone({ f: [380, 480], f2: 170, d: 0.08, vol: 0.3 }), ...many(4, () => noise({ type: 'bandpass', f: [2500, 4200], q: 3, d: 0.02, vol: 0.2, delay: [0.03, 0.25] }))]),
  impact('mdf_puff', [noise({ type: 'lowpass', f: 900, d: 0.08, vol: 1 }), tone({ f: [180, 230], f2: 110, d: 0.06, vol: 0.3 }), noise({ type: 'highpass', f: 3000, a: 0.01, d: 0.2, vol: 0.1 })]),
  // glass and ceramic
  impact('glass_bullet', [noise({ type: 'highpass', f: 4000, d: 0.05, vol: 0.7 }), tone({ f: [3200, 4200], f2: 2600, d: 0.2, vol: 0.14, wet: 0.3 }), ...many(4, () => tone({ f: [4000, 7000], d: 0.05, vol: 0.07, delay: [0.02, 0.2] }))]),
  impact('glass_blunt', [noise({ type: 'bandpass', f: 2200, q: 3, d: 0.05, vol: 0.8 }), tone({ f: [1400, 1800], f2: 1300, d: 0.2, vol: 0.16, wet: 0.3 })]),
  impact('glass_blade', [noise({ type: 'bandpass', f: 5000, q: 8, a: 0.02, d: 0.25, vol: 0.3 })]),
  impact('ceramic_hit', [noise({ type: 'bandpass', f: 3000, q: 2, d: 0.03, vol: 0.6 }), tone({ f: [1800, 2400], f2: 1600, d: 0.1, vol: 0.2 })]),
  impact('ceramic_bullet', [noise({ type: 'highpass', f: 2500, d: 0.06, vol: 0.85 }), ...many(5, () => tone({ f: [2500, 5000], d: 0.04, vol: 0.09, delay: [0, 0.15] }))]),
  // masonry and the ground
  impact('masonry_bullet', [noise({ type: 'bandpass', f: [1600, 2000], q: 1, d: 0.05, vol: 1.8 }), noise({ type: 'lowpass', f: 600, d: 0.12, vol: 0.9, wet: 0.2 }), ...many(4, () => noise({ type: 'bandpass', f: [2000, 4000], q: 3, d: 0.02, vol: 0.28, delay: [0.03, 0.3] }))]),
  impact('masonry_blunt', [tone({ f: [70, 95], f2: 45, d: 0.12, vol: 0.55 }), noise({ type: 'lowpass', f: 400, d: 0.1, vol: 0.5 })]),
  impact('masonry_blade', [noise({ type: 'bandpass', f: [2500, 3500], q: 4, a: 0.01, d: 0.15, vol: 0.4 })]),
  impact('plaster_puff', [noise({ type: 'lowpass', f: 900, d: 0.09, vol: 0.7 }), noise({ type: 'highpass', f: 3000, a: 0.01, d: 0.2, vol: 0.14 })]),
  impact('soil_bullet', [noise({ type: 'lowpass', f: 700, d: 0.08, vol: 2.2 }), ...many(3, () => noise({ type: 'bandpass', f: [1200, 2200], q: 2, d: 0.03, vol: 0.18, delay: [0.02, 0.2] }))]),
  impact('soil_blunt', [tone({ f: [55, 70], f2: 40, d: 0.1, vol: 0.45 }), noise({ type: 'lowpass', f: 300, d: 0.08, vol: 0.4 })]),
  impact('sand_hit', [noise({ type: 'bandpass', f: 3500, q: 0.8, a: 0.005, d: 0.15, vol: 0.45 }), noise({ type: 'lowpass', f: 500, d: 0.06, vol: 0.45 })]),
  impact('gravel_hit', [noise({ type: 'lowpass', f: 500, d: 0.06, vol: 0.45 }), ...many(6, () => noise({ type: 'bandpass', f: [1500, 3500], q: 3, d: 0.025, vol: 0.28, delay: [0, 0.18] }))]),
  // plastic, rubber, wax
  impact('plastic_hit', [noise({ type: 'bandpass', f: 1600, q: 3, d: 0.04, vol: 0.5 }), tone({ f: [380, 520], f2: 300, d: 0.08, vol: 0.32 })]),
  impact('plastic_bullet', [noise({ type: 'bandpass', f: 2500, q: 2, d: 0.03, vol: 1.3 }), tone({ f: [600, 800], f2: 450, d: 0.06, vol: 0.4 })]),
  impact('rubber_hit', [tone({ f: [90, 130], f2: 60, d: 0.1, vol: 0.45 }), noise({ type: 'lowpass', f: 350, d: 0.06, vol: 0.28 })]),
  impact('wax_hit', [noise({ type: 'lowpass', f: 800, d: 0.05, vol: 0.45 }), tone({ f: [240, 280], f2: 180, d: 0.05, vol: 0.22 })]),
  // soft things, paper, plants
  impact('soft_bullet', [noise({ type: 'lowpass', f: 450, a: 0.003, d: 0.1, vol: 1.8 }), noise({ type: 'bandpass', f: 900, q: 1, d: 0.05, vol: 0.5 })]),
  impact('fabric_hit', [noise({ type: 'lowpass', f: 650, d: 0.14, vol: 0.5 }), tone({ f: [85, 115], f2: 50, d: 0.12, vol: 0.28 })]),
  impact('fabric_rip', [noise({ type: 'bandpass', f: [2000, 2800], q: 1.5, a: 0.02, d: 0.25, vol: 0.4 }), ...many(4, () => noise({ type: 'bandpass', f: [3000, 5000], q: 4, d: 0.02, vol: 0.14, delay: [0, 0.22] }))]),
  impact('paper_hit', [noise({ type: 'bandpass', f: 2200, q: 1, d: 0.05, vol: 0.45 })]),
  impact('paper_tear', [noise({ type: 'highpass', f: 2500, a: 0.02, d: 0.3, vol: 0.15 })]),
  impact('leaf_rustle', many(6, () => noise({ type: 'bandpass', f: [2500, 6000], q: 2, d: 0.05, vol: 0.16, delay: [0, 0.3] }))),
  impact('branch_cut', [noise({ type: 'bandpass', f: 1500, q: 2, d: 0.04, vol: 0.55 }), tone({ f: [260, 340], f2: 150, d: 0.05, vol: 0.22 })]),
  impact('fruit_splat', [noise({ type: 'lowpass', f: 1200, d: 0.12, vol: 0.55 }), noise({ type: 'bandpass', f: 600, q: 0.7, d: 0.2, vol: 0.32 })]),
  // a round glancing off: steel whines down in pitch ("piiuu"), stone and concrete give a short crack with grit
  impact('ricochet_metal', [noise({ type: 'highpass', f: 3000, d: 0.02, vol: 0.6 }), tone({ f: [2800, 3600], f2: 900, d: 0.38, vol: 0.2, wet: 0.4 }), tone({ f: [5200, 6400], f2: 2000, d: 0.2, vol: 0.05 })]),
  impact('ricochet_stone', [noise({ type: 'bandpass', f: [2200, 2800], q: 2, d: 0.04, vol: 0.8 }), tone({ f: [1800, 2400], f2: 1200, d: 0.08, vol: 0.1 }), ...many(3, () => noise({ type: 'bandpass', f: [2500, 4500], q: 3, d: 0.015, vol: 0.2, delay: [0.02, 0.12] }))]),
  // breaks a material has of its own (the rest keep the art scene's shatter, crumble and splinter)
  impact('ceramic_break', [noise({ type: 'highpass', f: 1800, d: 0.3, vol: 0.85, wet: 0.4 }), ...many(8, () => tone({ f: [1800, 4500], d: [0.04, 0.1], vol: 0.15, delay: [0, 0.4] }))]),
  impact('tempered_burst', [noise({ type: 'highpass', f: 3500, d: 0.6, vol: 0.9, wet: 0.4 }), ...many(16, () => tone({ f: [4000, 8000], d: 0.04, vol: 0.08, delay: [0, 0.8] }))]),
  impact('plastic_crack', [noise({ type: 'bandpass', f: 1800, q: 2, d: 0.06, vol: 0.75 }), tone({ f: [450, 550], f2: 250, d: 0.05, vol: 0.22 })]),
  impact('mdf_crumble', [noise({ type: 'lowpass', f: 700, d: 0.25, vol: 0.75, wet: 0.2 }), ...many(4, () => noise({ type: 'lowpass', f: 500, d: 0.05, vol: 0.32, delay: [0.05, 0.3] }))]),
]

export const DESTRUCTION_SOUND_BANK: SoundBank = { id: 'destruction_three', sounds: [...SCENE_SOUNDS, ...DRAG_SOUNDS, ...LEAF_SOUNDS, ...IMPACT_SOUNDS, EXPLOSION_BOOM, ...BLAST_SOUNDS, ...FIRE_SOUNDS, GRENADE_PIN_PULL], loops: [BURN_LOOP, FIRE_LOOP, ...FIRE_FUEL_LOOPS, SMOKE_HISS_LOOP, ROCKET_MOTOR_LOOP] }
