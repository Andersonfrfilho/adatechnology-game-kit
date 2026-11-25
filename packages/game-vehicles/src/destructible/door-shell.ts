/**
 * A door, lid or tailgate is sheet metal folded round a frame: an outer skin, an inner panel a hand's depth behind it, and the fold that joins
 * them all round the edge. The skin a door takes off the body is one surface with no thickness; this closes it into that volume, in the
 * vehicle's coordinates and in plain numbers (the core package does not import three.js).
 */

/** How far behind its skin a door's inner panel stands, metres: the depth of a car door's frame. */
export const DOOR_SHELL_DEPTH = 0.09

/** A whole door, skin to inner panel, is no deeper than this, metres: a door whose skin curves far in (a beetle's) keeps its inner panel inside it. */
export const DOOR_SHELL_MAX_DEPTH = 0.25

/** Two corners closer than this, metres, are the same corner of the skin (the cut writes each triangle's corners on its own; float32 rounding of a car's coordinates is a few micrometres). */
const WELD = 1e-5

export type DoorShellParams = {
  /** The skin's triangles in the vehicle's coordinates, three corners of three numbers each, wound towards the outside. */
  readonly positions: ArrayLike<number>
  /** Which side of the car the door is on (the sign of its outward direction across the car). */
  readonly side: number
  /** Distance from the skin to the inner panel, metres (default `DOOR_SHELL_DEPTH`). */
  readonly depth?: number
  /** The outward direction of the skin, a unit vector (default across the car, `[0, 0, side]`); a tailgate faces backwards. */
  readonly outward?: readonly [number, number, number]
}

export type DoorShellResult = {
  /** The fold round the edge: a band from every free edge of the skin back to the inner panel. */
  readonly flange: Float32Array
  /** The inner panel: the skin moved in by the depth, wound to face into the car. */
  readonly inner: Float32Array
  /** Free edges the skin had (the edges the fold now covers). */
  readonly freeEdges: number
}

const cellOf = (v: number): number => Math.round(v / WELD)

/** The welded corner of every triangle corner, so that edges shared by two triangles are found as such (corners a hair apart across a cell are one). */
function weld(positions: ArrayLike<number>): { readonly ids: Int32Array; readonly points: number[] } {
  const ids = new Int32Array(positions.length / 3)
  const points: number[] = []
  const cells = new Map<string, number[]>()
  const near = (x: number, y: number, z: number): number | undefined => {
    const [cx, cy, cz] = [cellOf(x), cellOf(y), cellOf(z)]
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++)
        for (let k = -1; k <= 1; k++) {
          for (const id of cells.get(`${cx + i},${cy + j},${cz + k}`) ?? []) {
            if (Math.abs(points[id * 3]! - x) <= WELD && Math.abs(points[id * 3 + 1]! - y) <= WELD && Math.abs(points[id * 3 + 2]! - z) <= WELD) return id
          }
        }
    return undefined
  }
  for (let i = 0; i < ids.length; i++) {
    const x = positions[i * 3]!
    const y = positions[i * 3 + 1]!
    const z = positions[i * 3 + 2]!
    let id = near(x, y, z)
    if (id === undefined) {
      id = points.length / 3
      points.push(x, y, z)
      const key = `${cellOf(x)},${cellOf(y)},${cellOf(z)}`
      const cell = cells.get(key)
      if (cell) cell.push(id)
      else cells.set(key, [id])
    }
    ids[i] = id
  }
  return { ids, points }
}

/** The edges used by one triangle only, in the direction that triangle runs them. */
function freeEdgesOf(ids: Int32Array): Array<[number, number]> {
  const uses = new Map<string, { count: number; from: number; to: number }>()
  for (let t = 0; t < ids.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = ids[t + k]!
      const b = ids[t + ((k + 1) % 3)]!
      if (a === b) continue
      const key = a < b ? `${a}:${b}` : `${b}:${a}`
      const use = uses.get(key)
      if (use) use.count++
      else uses.set(key, { count: 1, from: a, to: b })
    }
  }
  const free: Array<[number, number]> = []
  uses.forEach((use) => {
    if (use.count === 1) free.push([use.from, use.to])
  })
  return free
}

/** Closes a skin into a shell: the inner panel behind it and the fold along every free edge, so no edge of the door is left open. */
export function doorShell(params: DoorShellParams): DoorShellResult {
  const depth = params.depth ?? DOOR_SHELL_DEPTH
  const [ox, oy, oz] = params.outward ?? [0, 0, params.side < 0 ? -1 : 1]
  const { positions } = params
  const along = (i: number): number => positions[i]! * ox + positions[i + 1]! * oy + positions[i + 2]! * oz
  let outermost = -Infinity
  for (let i = 0; i < positions.length; i += 3) outermost = Math.max(outermost, along(i))
  const floor = outermost - DOOR_SHELL_MAX_DEPTH
  // a corner moved in by the depth, but never deeper than the whole door may be
  const sink = (x: number, y: number, z: number): [number, number, number] => {
    const move = Math.max(0, Math.min(depth, x * ox + y * oy + z * oz - floor))
    return [x - ox * move, y - oy * move, z - oz * move]
  }
  const inner = new Float32Array(positions.length)
  for (let t = 0; t < positions.length; t += 9) {
    // the same triangle moved in, its winding reversed so it faces into the car
    for (const [to, from] of [
      [0, 0],
      [1, 2],
      [2, 1],
    ] as const) {
      inner.set(sink(positions[t + from * 3]!, positions[t + from * 3 + 1]!, positions[t + from * 3 + 2]!), t + to * 3)
    }
  }
  const { ids, points } = weld(positions)
  const free = freeEdgesOf(ids)
  const flange = new Float32Array(free.length * 18)
  const corner = (id: number, sunk: boolean): [number, number, number] => {
    const [x, y, z] = [points[id * 3]!, points[id * 3 + 1]!, points[id * 3 + 2]!]
    return sunk ? sink(x, y, z) : [x, y, z]
  }
  free.forEach(([a, b], i) => {
    // the skin runs a -> b along this edge: the fold runs it back, b -> a, down to the inner panel
    const quad = [corner(b, false), corner(a, false), corner(a, true), corner(b, false), corner(a, true), corner(b, true)]
    quad.forEach((p, k) => flange.set(p, i * 18 + k * 3))
  })
  return { flange, inner, freeEdges: free.length }
}

/** Free edges of a set of triangles taken together, longer than `minLength` metres (default any): zero when they close a volume. */
export function openEdgeCount(positions: ArrayLike<number>, minLength = 0): number {
  const { ids, points } = weld(positions)
  return freeEdgesOf(ids).filter(([a, b]) => Math.hypot(points[a * 3]! - points[b * 3]!, points[a * 3 + 1]! - points[b * 3 + 1]!, points[a * 3 + 2]! - points[b * 3 + 2]!) > minLength).length
}
