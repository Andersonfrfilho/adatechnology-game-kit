import { quat, rotateVec } from './math'
import type { FragmentMark, PartUnits, Quat, Vec3 } from './types'

/** One masonry unit (or panel) cut out of a wall, in the part's own axes. */
export interface UnitCell {
  center: Vec3
  size: Vec3
}

/** The two axes a wall spreads along: height is local y unless the part is thin along y (a slab), then x and z. */
export const planeAxes = (thin: number): [number, number] => (thin === 1 ? [0, 2] : [thin === 0 ? 2 : 0, 1])

/**
 * Every unit of the wall laid in `bond`: rows along the plane's second axis, running bond shifts odd rows by half a unit, edge units are cut to
 * the wall. More than `cap` units are merged into bigger ones (the same bond) so a whole wall stays a drawable number of fragments.
 */
export const unitGrid = (dims: Vec3, thin: number, units: Pick<PartUnits, 'size' | 'bond'>, cap: number): UnitCell[] => {
  const [u, v] = planeAxes(thin)
  let unitU = Math.min(units.size[0], dims[u]), unitV = Math.min(units.size[1], dims[v])
  const rowsFor = (h: number): number => Math.ceil(dims[v] / h - 1e-9)
  const colsFor = (w: number): number => Math.ceil(dims[u] / w - 1e-9) + (units.bond === 'running' ? 1 : 0)
  const merge = Math.ceil(Math.sqrt((rowsFor(unitV) * colsFor(unitU)) / cap))
  if (merge > 1) {
    unitU = Math.min(unitU * merge, dims[u])
    unitV = Math.min(unitV * merge, dims[v])
  }
  const cells: UnitCell[] = []
  for (let row = 0; row < rowsFor(unitV); row++) {
    const v0 = -dims[v] / 2 + row * unitV, v1 = Math.min(v0 + unitV, dims[v] / 2)
    const shift = units.bond === 'running' && row % 2 === 1 ? unitU / 2 : 0
    for (let col = 0; col < colsFor(unitU); col++) {
      const u0 = Math.max(-dims[u] / 2 + col * unitU - shift, -dims[u] / 2), u1 = Math.min(-dims[u] / 2 + (col + 1) * unitU - shift, dims[u] / 2)
      if (u1 - u0 < 0.01) continue
      const center: Vec3 = [0, 0, 0], size: Vec3 = [0, 0, 0]
      center[u] = (u0 + u1) / 2
      center[v] = (v0 + v1) / 2
      size[u] = u1 - u0
      size[v] = v1 - v0
      size[thin] = dims[thin]
      cells.push({ center, size })
    }
  }
  return cells
}

const planeDistance = (cell: UnitCell, thin: number, point: Vec3): number => {
  const [u, v] = planeAxes(thin)
  const du = cell.center[u] - point[u], dv = cell.center[v] - point[v]
  return Math.sqrt(du * du + dv * dv)
}

/** Units whose centre is within `radius` of `point` (part-local) in the wall plane; at least the nearest one. */
export const cellsWithin = (cells: readonly UnitCell[], thin: number, point: Vec3, radius: number): UnitCell[] => {
  const inside = cells.filter((c) => planeDistance(c, thin, point) <= radius)
  if (inside.length > 0 || cells.length === 0) return inside
  return [cells.reduce((best, c) => (planeDistance(c, thin, point) < planeDistance(best, thin, point) ? c : best))]
}

export const cellsOutside = (cells: readonly UnitCell[], thin: number, point: Vec3, radius: number): UnitCell[] => cells.filter((c) => planeDistance(c, thin, point) > radius)

/** A hole in the part's own axes. */
export interface LocalHole {
  point: Vec3
  normal: Vec3
  diameter: number
}

export const MAX_MARKS_PER_FRAGMENT = 12

/** The holes that fall inside a fragment box (`rotation` is the fragment's orientation in the part), in the fragment's own axes. */
export const marksInBox = (center: Vec3, size: Vec3, rotation: Quat | undefined, holes: readonly LocalHole[]): FragmentMark[] => {
  const inverse = rotation ? quat.conjugate(rotation) : undefined
  const marks: FragmentMark[] = []
  for (const hole of holes) {
    const offset: Vec3 = [hole.point[0] - center[0], hole.point[1] - center[1], hole.point[2] - center[2]]
    const point = inverse ? rotateVec(inverse, offset) : offset
    const inside = point.every((value, k) => Math.abs(value) <= size[k]! / 2 + hole.diameter / 2)
    if (!inside) continue
    marks.push({ point, normal: inverse ? rotateVec(inverse, hole.normal) : hole.normal, diameter: hole.diameter })
    if (marks.length >= MAX_MARKS_PER_FRAGMENT) break
  }
  return marks
}
