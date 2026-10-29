import type { MaterialDef, SurfaceLayer, Vec3 } from './types'

/** A surface layer with its material resolved; `energy` is what a bullet spends crossing one face's worth of it, in joules. */
export interface LayerRT {
  index: number
  def: SurfaceLayer
  mat: MaterialDef
  energy: number
}

/** `[layer, face (+1 or -1), x, y, z, radius]`: a patch of a layer that came off, in object-local space. Saved with the part. */
export type Spall = readonly [number, number, number, number, number, number]

export const MAX_SPALLS = 64

/** Index of the smallest dimension (the first one on a tie): the axis a wall is thin along. */
export const thinAxisOf = (dims: Vec3): number => (dims[0] <= dims[1] && dims[0] <= dims[2] ? 0 : dims[1] <= dims[2] ? 1 : 2)

export const resolveLayer = (def: SurfaceLayer, index: number, mat: MaterialDef): LayerRT => ({ index, def, mat, energy: mat.penetration * def.thickness * 1000 })

const onFace = (layer: LayerRT, face: number): boolean => layer.def.faces === 'both' || layer.def.faces === (face > 0 ? '+' : '-')

const isSpalled = (spalls: readonly Spall[] | undefined, layer: number, face: number, point: Vec3): boolean => {
  for (const s of spalls ?? []) {
    if (s[0] !== layer || s[1] !== face) continue
    const dx = s[2] - point[0], dy = s[3] - point[1], dz = s[4] - point[2]
    if (dx * dx + dy * dy + dz * dz <= s[5] * s[5]) return true
  }
  return false
}

/** The outermost layer still on `face` at `point` (layers are listed outermost first). */
export const outerLayer = (layers: readonly LayerRT[], spalls: readonly Spall[] | undefined, face: number, point: Vec3): LayerRT | undefined =>
  layers.find((l) => onFace(l, face) && !isSpalled(spalls, l.index, face, point))

/** Joules a bullet spends crossing every layer still on `face` at `point`. */
export const layersEnergy = (layers: readonly LayerRT[], spalls: readonly Spall[] | undefined, face: number, point: Vec3): number => {
  let sum = 0
  for (const l of layers) if (onFace(l, face) && !isSpalled(spalls, l.index, face, point)) sum += l.energy
  return sum
}

/** Metres of layer a ray crosses on one face (full thickness, before obliquity). */
export const layersThickness = (layers: readonly LayerRT[], face: number): number => {
  let sum = 0
  for (const l of layers) if (onFace(l, face)) sum += l.def.thickness
  return sum
}
