import type { Vec3 } from '@adatechnology/game-contracts'

/** A part as the ray sees it first: its bounding sphere in the object's frame. */
export type PartSphere = { readonly pos: Vec3; readonly bound: number }

/** The parts whose spheres a ray segment may meet, as indices into the list the grid was built from, in ascending order. */
export type PartGrid = {
  candidates(origin: Vec3, direction: Vec3, maxDistance: number, out: number[]): void
}

/** Objects with fewer parts are scanned whole: the grid only pays off on a house of hundreds of parts. */
export const PART_GRID_MIN_PARTS = 64
const MAX_CELLS_PER_AXIS = 64
/** Each sphere is entered a hair larger than it is, so a ray that grazes it at a cell boundary still finds it. */
const PAD = 1e-4

/**
 * A uniform grid over the bounding spheres of an object's parts. A ray walks only the cells its segment crosses, so a house of a thousand bricks tests the
 * few dozen near the ray instead of all of them. Conservative: every part whose sphere (grown by `slack`) meets the segment `[0, maxDistance]` is a
 * candidate, so testing the candidates in ascending order gives exactly the result of testing every part.
 */
export function buildPartGrid(parts: readonly PartSphere[], slack: number): PartGrid {
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const part of parts) {
    const r = part.bound + slack + PAD
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k]!, part.pos[k]! - r)
      max[k] = Math.max(max[k]!, part.pos[k]! + r)
    }
  }
  // a part posed at NaN (a degenerate matrix): every part is a candidate, as in the plain scan, instead of a grid of NaN cells
  if (![...min, ...max].every(Number.isFinite)) {
    return {
      candidates(_origin, _direction, _maxDistance, out) {
        out.length = 0
        for (let index = 0; index < parts.length; index++) out.push(index)
      },
    }
  }
  // cubic cells about as wide as a part is: a wall one brick thick gets one layer of cells, not twenty (a sphere would be entered in all twenty)
  let radiusSum = 0
  for (const part of parts) radiusSum += part.bound + slack + PAD
  const volume = Math.max(max[0]! - min[0]!, 1e-6) * Math.max(max[1]! - min[1]!, 1e-6) * Math.max(max[2]! - min[2]!, 1e-6)
  const edge = Math.max(Math.cbrt(volume / Math.max(parts.length, 1)), (2 * radiusSum) / Math.max(parts.length, 1))
  const sides: Vec3 = [0, 0, 0]
  const size: Vec3 = [0, 0, 0]
  for (let k = 0; k < 3; k++) {
    sides[k] = Math.max(1, Math.min(MAX_CELLS_PER_AXIS, Math.ceil((max[k]! - min[k]!) / edge)))
    size[k] = Math.max((max[k]! - min[k]!) / sides[k]!, 1e-6)
  }
  const [sideX, sideY, sideZ] = sides as [number, number, number]
  const cellCount = sideX * sideY * sideZ
  const cellIndex = (k: number, value: number): number => Math.min(sides[k]! - 1, Math.max(0, Math.floor((value - min[k]!) / size[k]!)))
  // the cells of each part in two flat passes (count, then fill) instead of a list per cell: a big object is made again whenever a blast splits it, and the first ray after pays for it
  const ranges = new Int32Array(parts.length * 6)
  const starts = new Uint32Array(cellCount + 1)
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index]!
    const r = part.bound + slack + PAD
    const at = index * 6
    for (let k = 0; k < 3; k++) {
      ranges[at + k] = cellIndex(k, part.pos[k]! - r)
      ranges[at + 3 + k] = cellIndex(k, part.pos[k]! + r)
    }
    for (let z = ranges[at + 2]!; z <= ranges[at + 5]!; z++) for (let y = ranges[at + 1]!; y <= ranges[at + 4]!; y++) for (let x = ranges[at]!; x <= ranges[at + 3]!; x++) starts[(z * sideY + y) * sideX + x + 1]!++
  }
  for (let cell = 0; cell < cellCount; cell++) starts[cell + 1]! += starts[cell]!
  const items = new Uint32Array(starts[cellCount]!)
  const fill = starts.slice(0, cellCount)
  for (let index = 0; index < parts.length; index++) {
    const at = index * 6
    for (let z = ranges[at + 2]!; z <= ranges[at + 5]!; z++) for (let y = ranges[at + 1]!; y <= ranges[at + 4]!; y++) for (let x = ranges[at]!; x <= ranges[at + 3]!; x++) items[fill[(z * sideY + y) * sideX + x]!++] = index
  }
  const seen = new Uint32Array(parts.length)
  let stamp = 0

  return {
    candidates(origin, direction, maxDistance, out) {
      out.length = 0
      // the segment clipped to the grid's box (slabs)
      let t0 = 0
      let t1 = maxDistance
      for (let k = 0; k < 3; k++) {
        const d = direction[k]!
        if (Math.abs(d) < 1e-12) {
          if (origin[k]! < min[k]! || origin[k]! > max[k]!) return
          continue
        }
        const a = (min[k]! - origin[k]!) / d
        const b = (max[k]! - origin[k]!) / d
        t0 = Math.max(t0, Math.min(a, b))
        t1 = Math.min(t1, Math.max(a, b))
        if (t0 > t1) return
      }
      stamp++
      if (stamp === 0xffffffff) {
        seen.fill(0)
        stamp = 1
      }
      // the cells the segment crosses (Amanatides-Woo), from its entry into the box; scalars, no allocation per ray
      const dx = direction[0]!, dy = direction[1]!, dz = direction[2]!
      let cx = cellIndex(0, origin[0]! + dx * t0), cy = cellIndex(1, origin[1]! + dy * t0), cz = cellIndex(2, origin[2]! + dz * t0)
      const sx = dx > 0 ? 1 : dx < 0 ? -1 : 0, sy = dy > 0 ? 1 : dy < 0 ? -1 : 0, sz = dz > 0 ? 1 : dz < 0 ? -1 : 0
      let nx = dx === 0 ? Infinity : (min[0]! + (cx + (dx > 0 ? 1 : 0)) * size[0]! - origin[0]!) / dx
      let ny = dy === 0 ? Infinity : (min[1]! + (cy + (dy > 0 ? 1 : 0)) * size[1]! - origin[1]!) / dy
      let nz = dz === 0 ? Infinity : (min[2]! + (cz + (dz > 0 ? 1 : 0)) * size[2]! - origin[2]!) / dz
      const ex = dx === 0 ? Infinity : size[0]! / Math.abs(dx), ey = dy === 0 ? Infinity : size[1]! / Math.abs(dy), ez = dz === 0 ? Infinity : size[2]! / Math.abs(dz)
      for (;;) {
        const cell = (cz * sideY + cy) * sideX + cx
        for (let k = starts[cell]!; k < starts[cell + 1]!; k++) {
          const index = items[k]!
          if (seen[index] === stamp) continue
          seen[index] = stamp
          out.push(index)
        }
        if (nx <= ny && nx <= nz) {
          if (nx > t1) break
          cx += sx
          if (cx < 0 || cx >= sideX) break
          nx += ex
        } else if (ny <= nz) {
          if (ny > t1) break
          cy += sy
          if (cy < 0 || cy >= sideY) break
          ny += ey
        } else {
          if (nz > t1) break
          cz += sz
          if (cz < 0 || cz >= sideZ) break
          nz += ez
        }
      }
      if (out.length > 1) out.sort((a, b) => a - b)
    },
  }
}
