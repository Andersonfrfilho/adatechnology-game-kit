import type { Vec3 } from '@adatechnology/game-contracts'

/** A part as the ray sees it first: its bounding sphere in the object's frame. */
export type PartSphere = { readonly pos: Vec3; readonly bound: number }

/** The parts whose spheres a ray segment may meet, as indices into the list the grid was built from, in ascending order. */
export type PartGrid = {
  candidates(origin: Vec3, direction: Vec3, maxDistance: number, out: number[]): void
}

/** Objects with fewer parts are scanned whole: the grid only pays off on a house of hundreds of parts. */
export const PART_GRID_MIN_PARTS = 64
const MAX_CELLS_PER_AXIS = 24
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
  const side = Math.max(1, Math.min(MAX_CELLS_PER_AXIS, Math.ceil(Math.cbrt(parts.length))))
  const size: Vec3 = [0, 0, 0]
  for (let k = 0; k < 3; k++) size[k] = Math.max((max[k]! - min[k]!) / side, 1e-6)
  const cells: number[][] = Array.from({ length: side * side * side }, () => [])
  const cellIndex = (k: number, value: number): number => Math.min(side - 1, Math.max(0, Math.floor((value - min[k]!) / size[k]!)))
  parts.forEach((part, index) => {
    const r = part.bound + slack + PAD
    const lo = [0, 1, 2].map((k) => cellIndex(k, part.pos[k]! - r))
    const hi = [0, 1, 2].map((k) => cellIndex(k, part.pos[k]! + r))
    for (let x = lo[0]!; x <= hi[0]!; x++) for (let y = lo[1]!; y <= hi[1]!; y++) for (let z = lo[2]!; z <= hi[2]!; z++) cells[(z * side + y) * side + x]!.push(index)
  })
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
        const list = cells[(cz * side + cy) * side + cx]!
        for (let k = 0; k < list.length; k++) {
          const index = list[k]!
          if (seen[index] === stamp) continue
          seen[index] = stamp
          out.push(index)
        }
        if (nx <= ny && nx <= nz) {
          if (nx > t1) break
          cx += sx
          if (cx < 0 || cx >= side) break
          nx += ex
        } else if (ny <= nz) {
          if (ny > t1) break
          cy += sy
          if (cy < 0 || cy >= side) break
          ny += ey
        } else {
          if (nz > t1) break
          cz += sz
          if (cz < 0 || cz >= side) break
          nz += ez
        }
      }
      if (out.length > 1) out.sort((a, b) => a - b)
    },
  }
}
