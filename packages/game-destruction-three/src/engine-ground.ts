/**
 * The ground a physics engine stands the pieces on, built from `groundAt` as triangles that keep its hard steps (a slab's edge, a crater's rim) as vertical
 * faces instead of one-cell ramps. Each cell reads its corners from just inside itself, so two cells on either side of a step each get their own level; where
 * the two edges they share differ, a vertical face joins them. A cell whose edge midpoints leave the straight line between its corners (a step crosses it)
 * is cut in four, down to `MIN_CELL`.
 */

/** Cells of a smooth tile (m) and the smallest a cell crossed by a step is cut to (m). A step lands within half of it from where it is. */
export const GROUND_CELL = 0.05
const MIN_CELL = 0.0125
/** How far inside its own cell a corner is read (m): on the cell's side of a step. */
const INSIDE = 0.0005
/** An edge whose midpoint is this far (m) off the line of its ends has a step in it. */
const BENT = 0.01
/** Two edges this close (m) are the same: no face between them. */
const SAME = 0.0005
/** A corner read inside its cell that differs from the corner itself by more than this (m) is on a step. */
const SNAP = 0.002

export interface GroundMesh {
  readonly vertices: number[]
  readonly indices: number[]
  /** Flat: the tile is level at `low` (a box is cheaper and solid below). */
  readonly flat: boolean
  readonly low: number
  readonly high: number
}

export const buildGroundMesh = (groundAt: (x: number, z: number) => number, x0: number, z0: number, size: number): GroundMesh => {
  const vertices: number[] = []
  const indices: number[] = []
  let low = Infinity
  let high = -Infinity
  /** Heights each finished cell left on its four sides (x0,z0,x1,z1 then its corner heights), to join to neighbours: by grid of the smallest cell. */
  const edges = new Map<string, { readonly at: readonly number[]; readonly ha: number; readonly hb: number; readonly inward: readonly [number, number] }>()
  const vertex = (x: number, y: number, z: number): number => {
    vertices.push(x, y, z)
    return vertices.length / 3 - 1
  }
  const face = (a: number, b: number, c: number, d: number): void => {
    indices.push(a, b, c, a, c, d)
  }
  const at = (x: number, z: number, cx: number, cz: number): number => {
    // a little toward the cell's centre (cx, cz) so a corner on a step reads this cell's side of it
    const exact = groundAt(x, z)
    const inside = groundAt(x + Math.sign(cx - x) * INSIDE, z + Math.sign(cz - z) * INSIDE)
    // smooth ground: the corner itself, shared with the neighbours; a step at the corner: this cell's side of it
    const h = Math.abs(inside - exact) > SNAP ? inside : exact
    low = Math.min(low, h)
    high = Math.max(high, h)
    return h
  }
  const cell = (x: number, z: number, s: number): void => {
    const cx = x + s / 2
    const cz = z + s / 2
    const h00 = at(x, z, cx, cz)
    const h10 = at(x + s, z, cx, cz)
    const h01 = at(x, z + s, cx, cz)
    const h11 = at(x + s, z + s, cx, cz)
    if (s > MIN_CELL * 1.5) {
      const mids: Array<[number, number, number]> = [
        [cx, z, (h00 + h10) / 2],
        [cx, z + s, (h01 + h11) / 2],
        [x, cz, (h00 + h01) / 2],
        [x + s, cz, (h10 + h11) / 2],
        [cx, cz, (h00 + h10 + h01 + h11) / 4],
      ]
      if (mids.some(([mx, mz, line]) => Math.abs(at(mx, mz, cx, cz) - line) > BENT)) {
        const h = s / 2
        cell(x, z, h)
        cell(x + h, z, h)
        cell(x, z + h, h)
        cell(x + h, z + h, h)
        return
      }
    }
    // counter-clockwise seen from above: the face looks up
    face(vertex(x, h00, z), vertex(x, h01, z + s), vertex(x + s, h11, z + s), vertex(x + s, h10, z))
    // the sides of the cell, by the smallest cells along them, so a cut cell meets an uncut neighbour
    const n = Math.round(s / MIN_CELL)
    for (let i = 0; i < n; i++) {
      const t0 = i / n
      const t1 = (i + 1) / n
      side(`x${Math.round(x / MIN_CELL)}:${Math.round(z / MIN_CELL) + i}`, [x, z + t0 * s, x, z + t1 * s], h00 + (h01 - h00) * t0, h00 + (h01 - h00) * t1, [1, 0])
      side(`x${Math.round((x + s) / MIN_CELL)}:${Math.round(z / MIN_CELL) + i}`, [x + s, z + t0 * s, x + s, z + t1 * s], h10 + (h11 - h10) * t0, h10 + (h11 - h10) * t1, [-1, 0])
      side(`z${Math.round(z / MIN_CELL)}:${Math.round(x / MIN_CELL) + i}`, [x + t0 * s, z, x + t1 * s, z], h00 + (h10 - h00) * t0, h00 + (h10 - h00) * t1, [0, 1])
      side(`z${Math.round((z + s) / MIN_CELL)}:${Math.round(x / MIN_CELL) + i}`, [x + t0 * s, z + s, x + t1 * s, z + s], h01 + (h11 - h01) * t0, h01 + (h11 - h01) * t1, [0, -1])
    }
  }
  /**
   * The first cell to reach a side leaves its heights; the second joins its own to them by a vertical face where they differ, facing the lower of the two
   * (`inward` points from the side into the second cell). One face, one side: the engine collides with the front of a triangle.
   */
  const side = (key: string, [ax, az, bx, bz]: readonly number[], ha: number, hb: number, inward: readonly [number, number]): void => {
    const seen = edges.get(key)
    if (!seen) {
      edges.set(key, { at: [ax, az, bx, bz], ha, hb, inward })
      return
    }
    edges.delete(key)
    wall([ax, az, bx, bz], ha, hb, [seen.ha, seen.hb], inward)
  }
  /** A vertical face from this cell's side (heights `ha`, `hb`) to the other's (`other`), facing the lower of the two. */
  const wall = ([ax, az, bx, bz]: readonly number[], ha: number, hb: number, other: readonly [number, number], inward: readonly [number, number]): void => {
    if (Math.abs(other[0] - ha) < SAME && Math.abs(other[1] - hb) < SAME) return
    const a0 = vertex(ax, ha, az)
    const b0 = vertex(bx, hb, bz)
    const b1 = vertex(bx, other[1], bz)
    const a1 = vertex(ax, other[0], az)
    // the horizontal part of the normal of (a0, b0, b1): (b0 - a0) x (b1 - a0)
    const ux = bx - ax, uy = hb - ha, uz = bz - az
    const vx = bx - ax, vy = other[1] - ha, vz = bz - az
    const nx = uy * vz - uz * vy
    const nz = ux * vy - uy * vx
    // the lower cell: this one when the other side is higher
    const rise = other[0] + other[1] - ha - hb
    const lower = rise > 0 ? inward : ([-inward[0], -inward[1]] as const)
    if (nx * lower[0] + nz * lower[1] > 0) face(a0, b0, b1, a1)
    else face(a1, b1, b0, a0)
  }
  const n = Math.round(size / GROUND_CELL)
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cell(x0 + i * GROUND_CELL, z0 + j * GROUND_CELL, GROUND_CELL)
  // the tile's own border: where the ground just outside is higher (a table's side on the line between two tiles), the wall is this tile's, facing in; the tile
  // outside, lower there, does the same from its side when the step goes the other way, so each wall is made once
  for (const { at, ha, hb, inward } of edges.values()) {
    const [ax, az, bx, bz] = at
    const ox = -inward[0] * INSIDE
    const oz = -inward[1] * INSIDE
    // the ends a hair along the edge too, so a corner reads the neighbour's side
    const ux = Math.sign(bx - ax) * INSIDE
    const uz = Math.sign(bz - az) * INSIDE
    const oa = groundAt(ax + ox + ux, az + oz + uz)
    const ob = groundAt(bx + ox - ux, bz + oz - uz)
    if (oa > ha + SNAP || ob > hb + SNAP) wall(at, ha, hb, [Math.max(oa, ha), Math.max(ob, hb)], inward)
  }
  // a wall on the border goes up to the neighbour: the tile is not a level slab then
  for (let i = 1; i < vertices.length; i += 3) high = Math.max(high, vertices[i])
  return { vertices, indices, flat: high - low < 1e-6, low, high }
}
