import { DISTANCE_CURVES } from '../falloff'
import type { BusId, SoundBank, SoundRecipe } from '../recipe'
import gameSfxJson from '../data/game-sfx.json'

/** One row of the game's `sfx` table (jogo L62096–62100): lowpass cutoff, peak gain and seconds of a noise burst. */
export type NoiseClass = {
  readonly id: string
  /** The name in the team code (`pistola`, `vidro`...). */
  readonly team: string
  readonly bus: BusId
  readonly cutoff: number
  readonly gain: number
  readonly seconds: number
}

type GameSfxTable = { readonly sources: readonly string[]; readonly classes: readonly NoiseClass[]; readonly fallback: NoiseClass }

const GAME_SFX = gameSfxJson as unknown as GameSfxTable

/** The 12 game classes, in the table's order. */
export const GAME_SFX_CLASSES: readonly NoiseClass[] = GAME_SFX.classes
/** What the game plays for a name it does not know: `[1000, 0.5, 0.1]`. */
export const GAME_SFX_FALLBACK: NoiseClass = GAME_SFX.fallback

/**
 * A class as a recipe: noise from a random point, the class lowpass (muffled by distance), the peak set at once and an exponential fall to 0.001 over
 * the class seconds, stopped 0.05 s later; the game's distance curve, silent below 0.01. Built in the game's `sfx` order (`burst`).
 */
export function noiseClassRecipe(row: NoiseClass, id = `sfx_${row.id}`): SoundRecipe {
  return {
    id,
    bus: row.bus,
    order: 'burst',
    duration: row.seconds,
    tail: 0.05,
    layers: [
      {
        source: { kind: 'noise', offset: 'random' },
        filters: { mode: 'serial', bank: [{ type: 'lowpass', frequency: { set: row.cutoff } }] },
        envelope: [
          [0, row.gain, 'set'],
          ['1d', 0.001, 'exp', 'fixed'],
        ],
      },
    ],
    falloff: DISTANCE_CURVES.game_sfx,
    sources: [...GAME_SFX.sources.map((source) => `${source} ${row.team}`)],
  }
}

/** The game's classes as a bank (`sfx_pistol`... and `sfx_unknown`). Subject banks pick their own classes from `GAME_SFX_CLASSES`. */
export const GAME_SFX_BANK: SoundBank = { id: 'game_sfx', sounds: [...GAME_SFX_CLASSES, GAME_SFX_FALLBACK].map((row) => noiseClassRecipe(row)) }
