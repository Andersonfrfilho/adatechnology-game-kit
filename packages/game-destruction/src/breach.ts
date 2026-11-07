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

const JOINT_GAP = 1e-4
/** Share of the shorter of two units their bed has to overlap for one to bear on the other: a unit held by a corner does not stand. */
const MIN_BEARING_SHARE = 0.25

/**
 * The units of a wall still standing (`standing(i)`) that no longer bear on its bottom through the units under them: a unit stands while its bed
 * overlaps a standing unit of the row below (the bottom row stands on what holds the wall). Masonry carries by bearing, and the mortar of a head
 * joint holds next to nothing in tension, so over a hole the courses step in by the bond (half a unit a course in running bond) and the triangle
 * above it comes down, as it does over an opening without a lintel; at the free end of a wall, all that hangs over the hole. A unit that keeps only a
 * corner of its bed (less than `MIN_BEARING_SHARE` of a unit) does not bear: the mortar of a joint does not hold its moment. A unit between two standing
 * units of its course is wedged by its head joints, so a gap of two units does not drop the one over it. A slab (thin along y)
 * has no bottom row: none.
 */
export const unsupportedCells = (cells: readonly UnitCell[], thin: number, dims: Vec3, standing: (index: number) => boolean): number[] => {
  if (thin === 1) return []
  const [u, v] = planeAxes(thin)
  const bottom = -dims[v] / 2
  const rowOf = (y: number): number => Math.round((y - bottom) * 1e4)
  const rows = new Map<number, number[]>()
  for (let i = 0; i < cells.length; i++) {
    if (!standing(i)) continue
    const cell = cells[i]!
    const key = rowOf(cell.center[v] - cell.size[v] / 2)
    const row = rows.get(key)
    if (row) row.push(i)
    else rows.set(key, [i])
  }
  const held = new Set<number>()
  const queue: number[] = []
  for (const i of rows.get(0) ?? []) {
    held.add(i)
    queue.push(i)
  }
  const overlap = (a: UnitCell, b: UnitCell): number =>
    Math.min(a.center[u] + a.size[u] / 2, b.center[u] + b.size[u] / 2) - Math.max(a.center[u] - a.size[u] / 2, b.center[u] - b.size[u] / 2)
  const climb = () => {
    while (queue.length > 0) {
      const cell = cells[queue.pop()!]!
      for (const j of rows.get(rowOf(cell.center[v] + cell.size[v] / 2)) ?? []) {
        const other = cells[j]!
        if (held.has(j) || overlap(cell, other) <= Math.max(JOINT_GAP, MIN_BEARING_SHARE * Math.min(cell.size[u], other.size[u]))) continue
        held.add(j)
        queue.push(j)
      }
    }
  }
  // the units of each course in order along the wall: a unit between two that stand is wedged between them by its head joints (it bridges a gap of
  // two units under it); one held on one side only would hang from its mortar, which does not hold the moment
  for (const row of rows.values()) row.sort((a, b) => cells[a]!.center[u] - cells[b]!.center[u])
  const touching = (a: UnitCell, b: UnitCell): boolean => Math.abs(a.center[u] + a.size[u] / 2 - (b.center[u] - b.size[u] / 2)) <= 1e-3
  for (let wedged = true; wedged;) {
    climb()
    wedged = false
    for (const row of rows.values()) {
      for (let k = 1; k < row.length - 1; k++) {
        const i = row[k]!
        if (held.has(i) || !held.has(row[k - 1]!) || !held.has(row[k + 1]!)) continue
        if (!touching(cells[row[k - 1]!]!, cells[i]!) || !touching(cells[i]!, cells[row[k + 1]!]!)) continue
        held.add(i)
        queue.push(i)
        wedged = true
      }
    }
  }
  const loose: number[] = []
  for (const row of rows.values()) for (const i of row) if (!held.has(i)) loose.push(i)
  return loose
}

/**
 * At most `cap` clumps of `cells` (part-local units of a wall laid in courses of `unit` [along, up] metres), each the box around the units whose middle
 * falls in one bin of whole units: a clump is a few bricks still held by their mortar, a course or two high and a brick or two long, never a slab. The
 * bins start one unit across and grow a course and then a unit at a time until there are no more than `cap`.
 */
export const clumpUnits = (cells: readonly UnitCell[], thin: number, unit: readonly [number, number], cap: number): UnitCell[] => {
  if (cells.length <= cap) return [...cells]
  const [u, v] = planeAxes(thin)
  let lo0 = Infinity, lo1 = Infinity
  for (const cell of cells) {
    lo0 = Math.min(lo0, cell.center[u] - cell.size[u] / 2)
    lo1 = Math.min(lo1, cell.center[v] - cell.size[v] / 2)
  }
  let along = 1, up = 1
  for (let grow = 0; ; grow++) {
    const bins = new Map<string, { lo: Vec3; hi: Vec3 }>()
    for (const cell of cells) {
      const key = `${Math.floor((cell.center[u] - lo0) / (along * unit[0]))}:${Math.floor((cell.center[v] - lo1) / (up * unit[1]))}`
      const bin = bins.get(key) ?? { lo: [Infinity, Infinity, Infinity] as Vec3, hi: [-Infinity, -Infinity, -Infinity] as Vec3 }
      for (let k = 0; k < 3; k++) {
        bin.lo[k] = Math.min(bin.lo[k]!, cell.center[k]! - cell.size[k]! / 2)
        bin.hi[k] = Math.max(bin.hi[k]!, cell.center[k]! + cell.size[k]! / 2)
      }
      bins.set(key, bin)
    }
    if (bins.size <= cap) {
      return [...bins.values()].map(({ lo, hi }) => ({ center: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2] as Vec3, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] as Vec3 }))
    }
    if (grow % 2 === 0) up++
    else along++
  }
}

