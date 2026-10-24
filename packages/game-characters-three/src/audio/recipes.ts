// The sounds of the bodies, as recipes of @adatechnology/game-audio. Two teams delivered them:
// - the game (`jogo.js`): the gemido and corredor groans (`voz`, L62143) and the hoarse scream (`grito`, L62128);
// - the art scene (`arte__cena-de-arte.js`): `voice` (L1325) behind groan, scream and leap, the inhale before a scream, what the player hears (grab, bite,
//   hurt) and what a wound sounds like (flesh, sever, gore).
// Each recipe draws its random numbers in the order of the team routine, so it leaves the trace of the team code (tests/audio.test.ts against
// tools/golden/fixtures/audio).
import { DISTANCE_CURVES, sceneNoise, sceneRecipe, sceneTone, sceneVoice } from '@adatechnology/game-audio'
import type { Layer, SoundBank, SoundRecipe } from '@adatechnology/game-audio'

/** The voice limiter group of the undead (`undead_voice`: five at once, one every 0.25 s, nearer than 40 m). */
export const UNDEAD_VOICE_GROUP = 'undead_voice'

const voiced = { bus: 'voices', group: UNDEAD_VOICE_GROUP } as const

const p = (param: string) => ({ param })

// ---- the game (jogo L62128-62155) ------------------------------------------------------------------------------------------------------------

/** `grito` (L62128): noise through three formants (700, 1150, 2600 Hz) swept from x1.15 to x0.8, a square LFO of 31 to 40 Hz on the gain. Not in the limiter group: the game calls it straight. */
export const SCREAM_HOARSE: SoundRecipe = {
  id: 'scream_hoarse',
  bus: 'voices',
  order: 'scream',
  duration: [1, 1.4],
  layers: [
    {
      source: { kind: 'noise', offset: 'random' },
      filters: {
        mode: 'parallel',
        bank: [
          { type: 'bandpass', q: 6, frequency: { from: 700 * 1.15, to: 700 * 0.8, curve: 'linear', over: 'duration' }, level: 1 },
          { type: 'bandpass', q: 8, frequency: { from: 1150 * 1.15, to: 1150 * 0.8, curve: 'linear', over: 'duration' }, level: 0.7 },
          { type: 'bandpass', q: 10, frequency: { from: 2600 * 1.15, to: 2600 * 0.8, curve: 'linear', over: 'duration' }, level: 0.35 },
        ],
      },
      modulators: [{ target: 'gain', wave: 'square', rate: [31, 40], depth: 0.35 }],
      envelope: [
        [0, 0, 'set'],
        [0.06, 0.9, 'linear'],
        ['0.6d', 0.9, 'set'],
        ['1d', 0.001, 'exp', 'fixed'],
      ],
    },
  ],
  falloff: DISTANCE_CURVES.game_scream,
  sources: ['jogo:L62128-62142 grito'],
}

const groanLayer = (base: number | { readonly param: string }): Layer => ({
  source: {
    kind: 'osc',
    wave: 'sawtooth',
    frequency: typeof base === 'number' ? { from: base, to: base * 0.7, curve: 'linear', over: 'duration' } : { from: base, to: { ...base, scale: 0.7 }, curve: 'linear', over: 'duration' },
  },
  filters: { mode: 'serial', bank: [{ type: 'bandpass', q: 3, frequency: { set: typeof base === 'number' ? base * 3 : { ...base, scale: 3 } } }] },
  envelope: [
    [0, 0, 'set'],
    [0.15, 0.25, 'linear'],
    ['1d', 0.001, 'exp', 'fixed'],
  ],
})

/** `voz('gemido')` (L62143): a sawtooth from 95 to 135 Hz falling to 0.7 of itself over 0.9 to 1.5 s, through a bandpass at three times the pitch. */
export const GROAN: SoundRecipe = {
  id: 'groan',
  ...voiced,
  order: 'groan',
  vars: { base: [95, 135], dur: [0.9, 1.5] },
  duration: p('dur'),
  layers: [groanLayer(p('base'))],
  falloff: DISTANCE_CURVES.game_voice,
  sources: ['jogo:L62143-62155 voz gemido'],
}

/** `voz('corredor')` (L62143): the same at 300 Hz. */
export const RUNNER_GROAN: SoundRecipe = {
  id: 'runner_groan',
  ...voiced,
  order: 'groan',
  vars: { dur: [0.9, 1.5] },
  duration: p('dur'),
  layers: [groanLayer(300)],
  falloff: DISTANCE_CURVES.game_voice,
  sources: ['jogo:L62143-62155 voz corredor'],
}

// ---- the art scene (cena L1345-L1356) ----------------------------------------------------------------------------------------------------------

const scene = (id: string, layers: readonly Layer[], line: string, options: Parameters<typeof sceneRecipe>[3] = {}): SoundRecipe => sceneRecipe(id, layers, line, options)

// `groan(z)` (L1345): `brute` is the Brutamonte, `run` is a chase speed above 3.4; the arguments are drawn in this order (pitch, length, formants) before `voice` draws its vibrato and breath start
const groan = (id: string, vars: NonNullable<SoundRecipe['vars']>, voice: Parameters<typeof sceneVoice>[0], line: string): SoundRecipe =>
  scene(id, [sceneVoice(voice)], line, { vars, ...voiced })

/** Groan of a walker: a sawtooth from 72 to 107 Hz down to 0 over 0.9 to 2 s, formants at 480-680 and 1050-1350 Hz. */
export const GROAN_WALKER = groan('groan_walker', { f0: [72, 107], d: [0.9, 2], fA: [480, 680], fB: [1050, 1350] }, { f0: p('f0'), f1: 0, d: p('d'), fA: p('fA'), fB: p('fB'), noise: 0.35, vol: 0.65 }, 'L1345 groan (walker)')
/** Groan of the brute: the walker's, an octave down (48 to 62 Hz). */
export const GROAN_BRUTE = groan('groan_brute', { f0: [48, 62], d: [0.9, 2], fA: [480, 680], fB: [1050, 1350] }, { f0: p('f0'), f1: 0, d: p('d'), fA: p('fA'), fB: p('fB'), noise: 0.35, vol: 0.65 }, 'L1345 groan (brute)')
/** Groan of a runner (chase above 3.4): a square wave from 160 to 250 Hz over 0.45 to 0.85 s, formants at 950 and 2300 Hz. */
export const GROAN_RUNNER = groan('groan_runner', { f0: [160, 250], d: [0.45, 0.85] }, { f0: p('f0'), f1: 0, d: p('d'), fA: 950, fB: 2300, noise: 0.6, vol: 0.5, wave: 'square' }, 'L1345 groan (runner)')

/** `scream(z)` (L1347): two voices, a sawtooth 520 to 880 Hz over 2.6 s and a square 640 to 1020 Hz over 2.4 s. */
export const SCREAM = scene(
  'scream',
  [
    sceneVoice({ f0: 520, f1: 880, d: 2.6, fA: 1800, fB: 3200, noise: 0.9, vol: 1.6 }),
    sceneVoice({ f0: 640, f1: 1020, d: 2.4, fA: 2400, fB: 3800, noise: 0.6, vol: 1.1, wave: 'square' }),
  ],
  'L1347 scream',
  { bus: 'voices' },
)
/** `inhale(z)` (L1348): the breath before a scream, bandpass 1400 Hz, rising for 0.6 s and falling for 0.9 s. */
export const INHALE = scene('inhale', [sceneNoise({ type: 'bandpass', f: 1400, q: 1.5, a: 0.6, d: 0.9, vol: 0.5 })], 'L1348 inhale', { bus: 'voices' })
/** `leap(z)` (L1349): a square voice 200 to 330 Hz over 0.5 s and a noise sweep from 600 to 1600 Hz. */
export const LEAP = scene('leap', [sceneVoice({ f0: 200, f1: 330, d: 0.5, fA: 1100, fB: 2500, noise: 0.7, vol: 0.6, wave: 'square' }), sceneNoise({ type: 'bandpass', f: 600, f2: 1600, d: 0.5, vol: 0.4 })], 'L1349 leap', { bus: 'voices' })

/** What the player hears when grabbed (L1350, at the listener). */
export const GRAB = scene('grab', [sceneNoise({ type: 'bandpass', f: 500, q: 1, d: 0.25, vol: 0.7 }), sceneTone({ wave: 'sawtooth', f: 90, f2: 60, d: 0.4, vol: 0.4 })], 'L1350 grab', { bus: 'voices' })
/** The bite (L1351, at the listener): a noise thump, four clicks and a falling sawtooth. */
export const BITE = scene(
  'bite',
  [
    sceneNoise({ f: 1400, d: 0.2, vol: 1.1 }),
    ...[0, 1, 2, 3].map((k) => sceneNoise({ type: 'highpass', f: 2500, d: 0.03, vol: 0.5, delay: 0.03 + k * 0.04 })),
    sceneTone({ wave: 'sawtooth', f: 320, f2: 170, d: 0.5, vol: 0.35, delay: 0.05 }),
  ],
  'L1351 bite',
  { bus: 'voices' },
)
/** The player is hurt (L1352, at the listener). */
export const HURT = scene('hurt', [sceneTone({ wave: 'sawtooth', f: 150, f2: 95, d: 0.22, vol: 0.3 }), sceneNoise({ f: 600, d: 0.1, vol: 0.4 })], 'L1352 hurt', { bus: 'voices' })

/** A bullet or a blow in flesh (L1353): a low thud, brighter and louder when it hits the head. */
export const FLESH = scene('flesh', [sceneNoise({ f: 650, d: 0.08, vol: 0.6 }), sceneTone({ f: 90, f2: 45, d: 0.07, vol: 0.5 })], 'L1353 flesh')
export const FLESH_HEAD = scene('flesh_head', [sceneNoise({ f: 1100, d: 0.12, vol: 0.9 }), sceneTone({ f: 130, f2: 45, d: 0.07, vol: 0.5 })], 'L1353 flesh (head)')
/** A limb cut off (L1355). */
export const SEVER = scene(
  'sever',
  [sceneNoise({ type: 'bandpass', f: 500, q: 0.8, d: 0.3, vol: 1 }), sceneNoise({ type: 'highpass', f: 2400, d: 0.06, vol: 0.7, delay: 0.02 }), sceneTone({ f: 110, f2: 40, d: 0.15, vol: 0.6 })],
  'L1355 sever',
)
/** A body opened or burst (L1356): a wet sweep and three bandpass splashes at random pitches. */
export const GORE = scene(
  'gore',
  [
    sceneNoise({ f: 900, f2: 200, d: 0.4, vol: 1.1, wet: 0.3 }),
    ...[0, 1, 2].map((k) => sceneNoise({ type: 'bandpass', f: [400, 800], q: 2, d: 0.08, vol: 0.5, delay: 0.08 + k * 0.07 })),
  ],
  'L1356 gore',
)

/** The sounds of the game and of the art scene for the bodies, in one bank. */
export const CHARACTER_SOUNDS: readonly SoundRecipe[] = [
  SCREAM_HOARSE,
  GROAN,
  RUNNER_GROAN,
  GROAN_WALKER,
  GROAN_BRUTE,
  GROAN_RUNNER,
  SCREAM,
  INHALE,
  LEAP,
  GRAB,
  BITE,
  HURT,
  FLESH,
  FLESH_HEAD,
  SEVER,
  GORE,
]

export const CHARACTER_SOUND_BANK: SoundBank = { id: 'characters_three', sounds: CHARACTER_SOUNDS }
