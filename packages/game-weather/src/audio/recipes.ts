// Rain, wind and thunder as recipes of @adatechnology/game-audio. The loops are the teams' (the art scene's `initAudio`, cena L1314-L1315, and the game's
// `chuva` loop, jogo L62116); the thunder is the game's `boom` (jogo L68278, a sine from 70 to 28 Hz) with a low rumble under it, the kit's choice.
import { sceneNoise, sceneTone } from '@adatechnology/game-audio'
import type { LoopRecipe, SoundBank, SoundRecipe } from '@adatechnology/game-audio'

/** Rain of the art scene: noise through a highpass at 600 Hz and a lowpass at 6000 Hz (cena L1314), opened at its volume. */
export const RAIN_LOOP: LoopRecipe = {
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
}

/** Wind of the art scene: noise through a lowpass at 320 Hz whose gain swings 0.035 at 0.07 Hz (cena L1315). */
export const WIND_LOOP: LoopRecipe = {
  id: 'wind_loop',
  bus: 'weather',
  order: 'chain_loop',
  source: { kind: 'noise', loop: true },
  filters: { mode: 'serial', bank: [{ type: 'lowpass', frequency: { set: 320 } }] },
  modulators: [{ target: 'gain', rate: 0.07, depth: 0.035 }],
  sources: ['cena:L1315'],
}

/** Rain of the game: noise through a highpass at 2500 Hz, created when the volume first passes 0.002 (jogo L62116 `chuva`). */
export const RAIN_HISS_GAME: LoopRecipe = {
  id: 'rain_hiss_game',
  bus: 'weather',
  order: 'game_loop',
  source: { kind: 'noise', loop: true },
  filters: { mode: 'serial', bank: [{ type: 'highpass', frequency: { set: 2500 } }] },
  sources: ['jogo:L62116 chuva'],
}

/**
 * Thunder. The thump is the game's boom (a sine from 70 to 28 Hz over 1.2 s); the rumble is a lowpassed noise that slides from 260 to 50 Hz over 3.2 s
 * with a reverb send, the kit's choice (no team has a thunder). It carries much farther than a blast: `k` is 0.00001, so a strike 1 km away is still at
 * 0.13 and one 4 km away (the farthest the weather places) at 0.009.
 */
export const THUNDER: SoundRecipe = {
  id: 'thunder',
  bus: 'weather',
  pan: true,
  layers: [sceneTone({ f: 70, f2: 28, d: 1.2, vol: 1 }), sceneNoise({ f: 260, f2: 50, d: 3.2, vol: 0.9, wet: 0.8 })],
  falloff: { model: 'inverse_square', k: 0.00001, scale: 1.4 },
  sources: ['jogo:L68278-68285 boom', 'sdk: rumble and falloff'],
}

export const WEATHER_BANK: SoundBank = { id: 'weather', sounds: [THUNDER], loops: [RAIN_LOOP, WIND_LOOP, RAIN_HISS_GAME] }
export const WEATHER_SOUNDS: readonly SoundRecipe[] = WEATHER_BANK.sounds ?? []
export const WEATHER_LOOPS: readonly LoopRecipe[] = WEATHER_BANK.loops ?? []
