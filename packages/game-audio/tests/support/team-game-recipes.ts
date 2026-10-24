// Recipes for the game routines whose subject package does not exist yet (scream and groan go to characters-three, the animal calls to
// animals-three, the boom to destruction-three, the rain loop to game-weather). They live here only to check the realizer against the team
// traces; the subject banks take them over in their own tasks.
import { DISTANCE_CURVES } from '../../src'
import type { Layer, LoopRecipe, SoundBank, SoundRecipe } from '../../src'

const scream: SoundRecipe = {
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
  sources: ['jogo:L62128-62142'],
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

const groan: SoundRecipe = {
  id: 'groan',
  bus: 'voices',
  order: 'groan',
  vars: { base: [95, 135], dur: [0.9, 1.5] },
  duration: { param: 'dur' },
  layers: [groanLayer({ param: 'base' })],
  falloff: DISTANCE_CURVES.game_voice,
  sources: ['jogo:L62143-62155 gemido'],
}

const runnerGroan: SoundRecipe = {
  id: 'runner_groan',
  bus: 'voices',
  order: 'groan',
  vars: { dur: [0.9, 1.5] },
  duration: { param: 'dur' },
  layers: [groanLayer(300)],
  falloff: DISTANCE_CURVES.game_voice,
  sources: ['jogo:L62143-62155 corredor'],
}

const boom: SoundRecipe = {
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
  sources: ['jogo:L68278-68285'],
}

const call = (id: string, options: { count: number; spacing: number; seconds: number; wave: OscillatorType; frequency: number; drop: number }): SoundRecipe => ({
  id,
  bus: 'world',
  order: 'calls',
  duration: options.seconds,
  tail: 0.02,
  keepSilent: true,
  layers: [
    {
      repeat: { count: options.count, spacing: options.spacing },
      source: { kind: 'osc', wave: options.wave, frequency: { from: options.frequency, to: options.frequency * options.drop, curve: 'exp', over: 'duration' } },
      filters: { mode: 'serial', bank: [{ type: 'bandpass', frequency: { set: options.frequency * 1.2 }, q: 3 }] },
      envelope: [
        [0, 0.0001, 'set', 'fixed'],
        [0.015, 1, 'exp'],
        ['1d', 0.0001, 'exp', 'fixed'],
      ],
    },
  ],
  falloff: DISTANCE_CURVES.animals,
  sources: ['jogo:L66625-66639'],
})

const rainLoop: LoopRecipe = {
  id: 'rain_hiss_game',
  bus: 'weather',
  order: 'game_loop',
  source: { kind: 'noise', loop: true },
  filters: { mode: 'serial', bank: [{ type: 'highpass', frequency: { set: 2500 } }] },
  sources: ['jogo:L62116 chuva'],
}

export const TEAM_GAME_BANK: SoundBank = {
  id: 'team_game',
  sounds: [
    scream,
    groan,
    runnerGroan,
    boom,
    call('dog_bark', { count: 2, spacing: 0.22, seconds: 0.12, wave: 'square', frequency: 520, drop: 0.6 }),
    call('lapwing_call', { count: 3, spacing: 0.14, seconds: 0.09, wave: 'square', frequency: 2400, drop: 0.6 }),
    call('hen_cluck', { count: 4, spacing: 0.14, seconds: 0.09, wave: 'square', frequency: 900, drop: 0.6 }),
    call('cow_moo', { count: 1, spacing: 0.14, seconds: 1.2, wave: 'sawtooth', frequency: 140, drop: 0.8 }),
  ],
  loops: [rainLoop],
}

/** The game's team names to the recipe ids. */
export const GAME_LOOP_IDS: Readonly<Record<string, string>> = { motor: 'engine_saw', chuva: 'rain_hiss_game', horda: 'crowd_rumble', rotor: 'rotor_blades' }
export const ANIMAL_IDS: Readonly<Record<string, string>> = { latido: 'dog_bark', queroquero: 'lapwing_call', cacarejo: 'hen_cluck', mugido: 'cow_moo' }

// The art scene's three loops in `initAudio` (cena L1314–1316). Their subjects (rain and wind in game-weather, fire in destruction-three) take them
// over in their own tasks; here they only let the trace of the whole chain be checked.
export const TEAM_ART_SCENE_LOOPS: readonly LoopRecipe[] = [
  {
    id: 'rain_loop',
    bus: 'weather',
    order: 'chain_loop',
    source: { kind: 'noise', loop: true },
    filters: {
      mode: 'serial',
      bank: [
        { type: 'highpass', frequency: { set: 600 } },
        { type: 'lowpass', frequency: { set: 6000 } },
      ],
    },
    sources: ['cena:L1314'],
  },
  {
    id: 'wind_loop',
    bus: 'weather',
    order: 'chain_loop',
    source: { kind: 'noise', loop: true },
    filters: { mode: 'serial', bank: [{ type: 'lowpass', frequency: { set: 320 } }] },
    modulators: [{ target: 'gain', rate: 0.07, depth: 0.035 }],
    sources: ['cena:L1315'],
  },
  {
    id: 'fire_loop',
    bus: 'world',
    order: 'chain_loop',
    source: { kind: 'noise', loop: true },
    filters: { mode: 'serial', bank: [{ type: 'bandpass', frequency: { set: 1800 }, q: 0.6 }] },
    sources: ['cena:L1316'],
  },
]
export const TEAM_ART_SCENE_BANK: SoundBank = { id: 'team_art_scene', loops: TEAM_ART_SCENE_LOOPS }
