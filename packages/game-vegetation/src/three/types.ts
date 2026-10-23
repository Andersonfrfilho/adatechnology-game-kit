import type * as ThreeTypes from 'three'
import type { MaterialIds } from '../destruction'

/** The THREE namespace is passed in by the host at runtime (r160). This package only imports its types. */
export type ThreeNS = typeof ThreeTypes
export type Material = ThreeTypes.Material

export const MAX_ACTORS = 4

export interface WindSettings {
  /** world-space direction on the xz plane (normalized internally) */
  direction: [number, number]
  /** 0..1 */
  strength: number
  /** 0..1 slowly varying extra push */
  gust: number
}
export interface ActorInput {
  x: number
  y: number
  z: number
  radius: number
}
export interface MaterialOptions {
  /** override of the destruction SDK material ids written to `userData.destructionMaterial` (see DEFAULT_MATERIAL_IDS) */
  materialIds?: Partial<MaterialIds>
  /** flat shaded foliage (default true) */
  flatShading?: boolean
  roughness?: number
  /** override the alpha cut etc. in the future; currently unused */
  [key: string]: unknown
}
export interface VegetationMaterials {
  /** resolved destruction material ids used by createPlantObject / createLotObject unless they get their own `materialIds` */
  materialIds?: MaterialIds
  wood: ThreeTypes.MeshStandardMaterial
  foliage: ThreeTypes.MeshStandardMaterial
  flowers: ThreeTypes.MeshStandardMaterial
  fruit: ThreeTypes.MeshStandardMaterial
  spines: ThreeTypes.MeshStandardMaterial
  /** advance the wind clock (seconds). Does not allocate. */
  update(timeSeconds: number): void
  setWind(wind: Partial<WindSettings>): void
  /** up to MAX_ACTORS actors bend the vegetation away; extra entries are ignored. Does not allocate. */
  setActors(actors: readonly ActorInput[]): void
  dispose(): void
}
