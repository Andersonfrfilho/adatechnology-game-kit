// Recipes for the game routines whose subject bank has not taken them over: the boom (destruction-three has its own; this copy checks the realizer in
// the engine's own tests) and the rain loop (game-weather). The scream and groans moved to characters-three and the animal calls to animals-three,
// whose tests run them against the same team traces.
import { DISTANCE_CURVES } from '../../src'
import type { LoopRecipe, SoundBank, SoundRecipe } from '../../src'

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
  sounds: [boom],
  loops: [rainLoop],
}

/** The game's team names to the recipe ids. */
export const GAME_LOOP_IDS: Readonly<Record<string, string>> = { motor: 'engine_saw', chuva: 'rain_hiss_game', horda: 'crowd_rumble', rotor: 'rotor_blades' }

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
