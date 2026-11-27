/** Vertices of a box as three.js draws it: four on each of its six faces. */
const BOX_VERTICES = 24
/** Most boxes a part may be drawn with to be held box by box. */
const MAX_BOXES = 16
/** How far (in the mesh's own units) a vertex may be from a corner of its box. */
const CORNER = 1e-4
/**
 * A part drawn as separate boxes holds the air between them when held as one box: under this share of the box around them they are held one by one. A board with a
 * doorway cut in it (two jambs and a lintel) fills about half of the box around it, and the doorway is air: only boards that all but fill their box (the planks of a
 * top, with the gaps between them) are one box.
 */
const HOLLOW = 0.8

/** A box a part is drawn with, in the mesh's own space: `rotation` (x y z w) when it is turned there (a roof slab), else it lies along the axes. */
export type DrawnBox = { readonly center: readonly number[]; readonly half: readonly number[]; readonly rotation?: readonly number[] }

const dot = (a: readonly number[], b: readonly number[]): number => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!

/** The unit quaternion (x y z w) of the frame whose axes are the unit vectors `x`, `y`, `z` (right-handed). */
const quaternionOf = (x: readonly number[], y: readonly number[], z: readonly number[]): number[] => {
  const [m00, m10, m20] = x as [number, number, number]
  const [m01, m11, m21] = y as [number, number, number]
  const [m02, m12, m22] = z as [number, number, number]
  const trace = m00 + m11 + m22
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1)
    return [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s]
  }
  if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22)
    return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]
  }
  if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22)
    return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]
  }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11)
  return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]
}

/** The box whose eight corners the 24 vertices from `first` are, three on each, lying along the axes; null when they are not. */
const straightBoxOf = (points: ArrayLike<number>, first: number): DrawnBox | null => {
  const low = [Infinity, Infinity, Infinity]
  const high = [-Infinity, -Infinity, -Infinity]
  for (let v = first; v < first + BOX_VERTICES; v++) {
    for (let k = 0; k < 3; k++) {
      low[k] = Math.min(low[k] as number, points[v * 3 + k] as number)
      high[k] = Math.max(high[k] as number, points[v * 3 + k] as number)
    }
  }
  const corners = new Set<number>()
  for (let v = first; v < first + BOX_VERTICES; v++) {
    let corner = 0
    for (let k = 0; k < 3; k++) {
      const x = points[v * 3 + k] as number
      if (Math.abs(x - (high[k] as number)) <= CORNER) corner |= 1 << k
      else if (Math.abs(x - (low[k] as number)) > CORNER) return null
    }
    corners.add(corner)
  }
  if (corners.size !== 8) return null
  return { center: [(low[0]! + high[0]!) / 2, (low[1]! + high[1]!) / 2, (low[2]! + high[2]!) / 2], half: [(high[0]! - low[0]!) / 2, (high[1]! - low[1]!) / 2, (high[2]! - low[2]!) / 2] }
}

/**
 * The box whose eight corners the 24 vertices from `first` are when it is turned in the mesh's space (a roof slab, a brace): its three edges from one corner are at right
 * angles and the other corners are their sums. Null when the vertices are not the corners of a box.
 */
const turnedBoxOf = (points: ArrayLike<number>, first: number): DrawnBox | null => {
  const corners: number[][] = []
  for (let v = first; v < first + BOX_VERTICES; v++) {
    const p = [points[v * 3] as number, points[v * 3 + 1] as number, points[v * 3 + 2] as number]
    if (!corners.some((c) => Math.abs(c[0]! - p[0]!) <= CORNER && Math.abs(c[1]! - p[1]!) <= CORNER && Math.abs(c[2]! - p[2]!) <= CORNER)) corners.push(p)
  }
  if (corners.length !== 8) return null
  const origin = corners[0]!
  const edges = corners.slice(1).map((c) => [c[0]! - origin[0]!, c[1]! - origin[1]!, c[2]! - origin[2]!])
  const lengths = edges.map((e) => Math.hypot(e[0]!, e[1]!, e[2]!))
  const square = (i: number, j: number): boolean => Math.abs(dot(edges[i]!, edges[j]!)) <= CORNER * (lengths[i]! + lengths[j]! + 1)
  for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) for (let k = j + 1; k < 7; k++) {
    if (!square(i, j) || !square(i, k) || !square(j, k)) continue
    const [a, b, c] = [edges[i]!, edges[j]!, edges[k]!]
    // every corner is the first one plus some of the three edges
    const sums = [[0, 0, 0], a, b, c, [a[0]! + b[0]!, a[1]! + b[1]!, a[2]! + b[2]!], [a[0]! + c[0]!, a[1]! + c[1]!, a[2]! + c[2]!], [b[0]! + c[0]!, b[1]! + c[1]!, b[2]! + c[2]!], [a[0]! + b[0]! + c[0]!, a[1]! + b[1]! + c[1]!, a[2]! + b[2]! + c[2]!]]
    const found = sums.every((s) => corners.some((p) => Math.abs(p[0]! - origin[0]! - s[0]!) <= 4 * CORNER && Math.abs(p[1]! - origin[1]! - s[1]!) <= 4 * CORNER && Math.abs(p[2]! - origin[2]! - s[2]!) <= 4 * CORNER))
    if (!found) continue
    const [la, lb, lc] = [lengths[i]!, lengths[j]!, lengths[k]!]
    if (la <= 0 || lb <= 0 || lc <= 0) return null
    const x = [a[0]! / la, a[1]! / la, a[2]! / la]
    const y = [b[0]! / lb, b[1]! / lb, b[2]! / lb]
    let z = [c[0]! / lc, c[1]! / lc, c[2]! / lc]
    // right-handed: the third axis is the cross of the first two
    const cross = [x[1]! * y[2]! - x[2]! * y[1]!, x[2]! * y[0]! - x[0]! * y[2]!, x[0]! * y[1]! - x[1]! * y[0]!]
    if (dot(cross, z) < 0) z = [-z[0]!, -z[1]!, -z[2]!]
    const far = sums[7]!
    return { center: [origin[0]! + far[0]! / 2, origin[1]! + far[1]! / 2, origin[2]! + far[2]! / 2], half: [la / 2, lb / 2, lc / 2], rotation: quaternionOf(x, y, z) }
  }
  return null
}

/**
 * The boxes a part is drawn with when they leave the box around them partly empty (a door frame: two posts and a lintel; a kennel: boards round the air; the slabs of a
 * roof, or one of them alone, turned in its mesh), from its vertices in the mesh's own space (x y z). Null when it is not drawn that way: every group of 24 vertices must be the eight
 * corners of a box, three vertices on each, lying along the axes or turned, and the boxes must fill under `HOLLOW` of the box around them all.
 */
export const hollowBoxesOf = (points: ArrayLike<number>): DrawnBox[] | null => {
  const count = points.length / 3
  if (count === 0 || count % BOX_VERTICES !== 0 || count / BOX_VERTICES > MAX_BOXES) return null
  const boxes: DrawnBox[] = []
  const low = [Infinity, Infinity, Infinity]
  const high = [-Infinity, -Infinity, -Infinity]
  for (let first = 0; first < count; first += BOX_VERTICES) {
    const box = straightBoxOf(points, first) ?? turnedBoxOf(points, first)
    if (!box) return null
    boxes.push(box)
  }
  for (let i = 0; i < points.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      low[k] = Math.min(low[k] as number, points[i + k] as number)
      high[k] = Math.max(high[k] as number, points[i + k] as number)
    }
  }
  const filled = boxes.reduce((sum, box) => sum + 8 * box.half[0]! * box.half[1]! * box.half[2]!, 0)
  return filled < HOLLOW * (high[0]! - low[0]!) * (high[1]! - low[1]!) * (high[2]! - low[2]!) ? boxes : null
}
