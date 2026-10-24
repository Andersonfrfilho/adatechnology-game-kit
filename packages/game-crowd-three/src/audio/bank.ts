// The crowd's sounds as recipes of @adatechnology/game-audio, ported literally from the team game: the hoarse scream (`grito`, jogo L62128-62142), the groan
// and the runner's groan (`voz`, jogo L62143-62155) and the animal calls of the herd (`bichoSom`, jogo L66625-66639). The same recipes are checked against the
// team traces in game-audio's tests (tests/support/team-game-recipes.ts), which keeps its own copy so it does not depend on this package.
import { DISTANCE_CURVES } from '@adatechnology/game-audio'
import type { Layer, SoundBank, SoundRecipe } from '@adatechnology/game-audio'

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

/** The crowd's sound bank: register it in the host's engine (`host.audio.register`) and the crowd's and the herd's sound ids play. */
export const CROWD_SOUND_BANK: SoundBank = {
  id: 'crowd',
  sounds: [
    scream,
    groan,
    runnerGroan,
    call('dog_bark', { count: 2, spacing: 0.22, seconds: 0.12, wave: 'square', frequency: 520, drop: 0.6 }),
    call('lapwing_call', { count: 3, spacing: 0.14, seconds: 0.09, wave: 'square', frequency: 2400, drop: 0.6 }),
    call('hen_cluck', { count: 4, spacing: 0.14, seconds: 0.09, wave: 'square', frequency: 900, drop: 0.6 }),
    call('cow_moo', { count: 1, spacing: 0.14, seconds: 1.2, wave: 'sawtooth', frequency: 140, drop: 0.8 }),
  ],
}

/** The herd's sound ids (`HERD_ROLES`) to the bank's recipes; the crowd's own ids (`groan`, `runner_groan`, `scream_hoarse`) are the recipes' ids already. */
export const HERD_SOUND_IDS: Readonly<Record<string, string>> = { bark: 'dog_bark', lapwing: 'lapwing_call', cluck: 'hen_cluck', moo: 'cow_moo' }
