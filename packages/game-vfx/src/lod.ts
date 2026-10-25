import type { LodBands } from './types'

/** The game's bands: distance minus the visual radius, 15 / 40 / 80 m, scales 1 / .5 / .2 / .1 (G68203, the Workshop's quality bands). The default. */
export const LOD_GAME: LodBands = { edges: [15, 40, 80], scales: [1, 0.5, 0.2, 0.1], radiusFactor: 1 }

/** The Lab's own bands (L481): distance minus three visual radii, 20 / 45 / 85 m, scales 1 / .5 / .2 / .08. Used on the bench and in the goldens. */
export const LOD_LAB: LodBands = { edges: [20, 45, 85], scales: [1, 0.5, 0.2, 0.08], radiusFactor: 3 }

/** The scale of an effect `distance` metres from the camera, for an effect whose fireball has `visualRadius`. */
export function lodScale(bands: LodBands, distance: number, visualRadius: number): number {
  const effective = distance - visualRadius * bands.radiusFactor
  if (effective < bands.edges[0]) return bands.scales[0]
  if (effective < bands.edges[1]) return bands.scales[1]
  if (effective < bands.edges[2]) return bands.scales[2]
  return bands.scales[3]
}
