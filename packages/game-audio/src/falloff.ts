import type { Falloff } from './recipe'

/** The distance curves of the team routines, by name. Each recipe carries its own; these are the values to copy. */
export const DISTANCE_CURVES = {
  /** The game's `sfx`: `vol / (1 + d² × 0.004)`, cutoff `/ (1 + d × 0.01)`, silent below 0.01 (jogo L62091–62092, L62101). */
  game_sfx: { model: 'inverse_square', k: 0.004, cutoffK: 0.01, minGain: 0.01 },
  /** The game's `grito`: `1 / (1 + d² × 0.006)`, silent below 0.02 (jogo L62129–62130). */
  game_scream: { model: 'inverse_square', k: 0.006, minGain: 0.02 },
  /** The game's `voz`: `1 / (1 + d² × 0.01)`, silent below 0.02 (jogo L62146–62147). */
  game_voice: { model: 'inverse_square', k: 0.01, minGain: 0.02 },
  /** The game's `boom`: `1.4 / (1 + d² × 0.002)`, never silent (jogo L68280). */
  game_boom: { model: 'inverse_square', k: 0.002, scale: 1.4 },
  /** The art scene's `outAt`: `vol / (1 + d² × 0.008)` (cena L1320). */
  art_scene: { model: 'inverse_square', k: 0.008 },
  /** The game's animal calls: `max(0, 1 − d / 70) × 0.25`, silent at or below 0.005 (jogo L66627–66628). */
  animals: { model: 'linear', range: 70, scale: 0.25, minGain: 0.005 },
} as const satisfies Readonly<Record<string, Falloff>>

export type DistanceCurveName = keyof typeof DISTANCE_CURVES

/** The level at `distance` for a sound at `volume`, before the recipe's envelope. */
export function falloffGain(falloff: Falloff | undefined, volume: number, distance: number): number {
  if (!falloff || falloff.model === 'none') return volume
  if (falloff.model === 'linear') {
    const level = Math.max(0, 1 - distance / falloff.range) * volume
    return falloff.scale === undefined ? level : level * falloff.scale
  }
  const level = volume / (1 + distance * distance * falloff.k)
  return falloff.scale === undefined ? level : falloff.scale * level
}

/** Whether a level is too quiet to play: below `minGain` (the game's `att < 0.01`), or at or below it for `linear` (the animal calls' `v <= 0.005`). */
export function isSilent(falloff: Falloff | undefined, gain: number): boolean {
  if (!falloff || falloff.model === 'none' || falloff.minGain === undefined) return false
  return falloff.model === 'linear' ? gain <= falloff.minGain : gain < falloff.minGain
}

/** What every lowpass cutoff is divided by at `distance` (1 when the curve has no muffling). */
export function cutoffDivisor(falloff: Falloff | undefined, distance: number): number {
  if (!falloff || falloff.model !== 'inverse_square' || falloff.cutoffK === undefined) return 1
  return 1 + distance * falloff.cutoffK
}
