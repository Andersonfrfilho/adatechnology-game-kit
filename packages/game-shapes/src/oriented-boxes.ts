type Vec3 = [number, number, number]
type Quat = [number, number, number, number]

/** A box turned as what it holds is turned: centre, half sizes along its own axes, and its rotation (in the frame the points were given in). */
export interface OrientedBox {
  readonly center: Vec3
  readonly half: Vec3
  readonly rotation: Quat
}

/** The thinnest half a fitted box gets (m): a drawn plane (a roof sheet with no thickness) is a 2 cm plate. */
const MIN_HALF = 0.01
/** How many times a box is cut in two at most (up to 2^depth boxes), and how much smaller the two halves must hold the points in to be kept apart. */
const MAX_DEPTH = 3
const SPLIT_GAIN = 0.7
const MIN_POINTS = 8
/**
 * A box is cut only while it holds air across its thinnest side (thicker than this, m, and than `FAT` of its middle side): the points are vertices of a surface that
 * is drawn between them, so a plate cut into its rows of vertices would lose the surface between them. Points that sample the surface (`isSurface`) have no such rows: the air shows.
 */
const THICK = 0.03
const FAT = 0.15

/** Eigenvectors of a symmetric 3x3 matrix (Jacobi rotations), as the columns of a row-major 3x3. */
const eigenvectors = (a: number[]): number[] => {
  const m = a.slice()
  const v = [1, 0, 0, 0, 1, 0, 0, 0, 1]
  for (let sweep = 0; sweep < 24; sweep++) {
    const off = Math.abs(m[1]) + Math.abs(m[2]) + Math.abs(m[5])
    if (off < 1e-12) break
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]] as const) {
      const apq = m[p * 3 + q]
      if (Math.abs(apq) < 1e-15) continue
      const theta = (m[q * 3 + q] - m[p * 3 + p]) / (2 * apq)
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
      const c = 1 / Math.sqrt(t * t + 1)
      const s = t * c
      for (let k = 0; k < 3; k++) {
        const mkp = m[k * 3 + p], mkq = m[k * 3 + q]
        m[k * 3 + p] = c * mkp - s * mkq
        m[k * 3 + q] = s * mkp + c * mkq
      }
      for (let k = 0; k < 3; k++) {
        const mpk = m[p * 3 + k], mqk = m[q * 3 + k]
        m[p * 3 + k] = c * mpk - s * mqk
        m[q * 3 + k] = s * mpk + c * mqk
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k * 3 + p], vkq = v[k * 3 + q]
        v[k * 3 + p] = c * vkp - s * vkq
        v[k * 3 + q] = s * vkp + c * vkq
      }
    }
  }
  return v
}

/** The quaternion of a rotation whose columns are the axes (x, y, z), made right-handed. */
const quatOfAxes = (v: number[]): Quat => {
  // the third axis as the cross of the first two: a reflection is not a rotation
  v[2] = v[3] * v[7] - v[6] * v[4]
  v[5] = v[6] * v[1] - v[0] * v[7]
  v[8] = v[0] * v[4] - v[3] * v[1]
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = v
  const trace = m00 + m11 + m22
  let x: number, y: number, z: number, w: number
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1)
    w = 0.25 / s
    x = (m21 - m12) * s
    y = (m02 - m20) * s
    z = (m10 - m01) * s
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22)
    w = (m21 - m12) / s
    x = 0.25 * s
    y = (m01 + m10) / s
    z = (m02 + m20) / s
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22)
    w = (m02 - m20) / s
    x = (m01 + m10) / s
    y = 0.25 * s
    z = (m12 + m21) / s
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11)
    w = (m10 - m01) / s
    x = (m02 + m20) / s
    y = (m12 + m21) / s
    z = 0.25 * s
  }
  const l = Math.hypot(x, y, z, w)
  return [x / l, y / l, z / l, w / l]
}

interface Fit {
  readonly box: OrientedBox
  readonly axes: number[]
  readonly volume: number
}

/** The box along the principal axes of the points (x y z triples), with its axes (columns) and volume. */
const fitOne = (points: readonly number[]): Fit => {
  const n = points.length / 3
  let mx = 0, my = 0, mz = 0
  for (let i = 0; i < points.length; i += 3) {
    mx += points[i]
    my += points[i + 1]
    mz += points[i + 2]
  }
  mx /= n
  my /= n
  mz /= n
  const c = [0, 0, 0, 0, 0, 0, 0, 0, 0]
  for (let i = 0; i < points.length; i += 3) {
    const d = [points[i] - mx, points[i + 1] - my, points[i + 2] - mz]
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) c[r * 3 + k] += d[r] * d[k]
  }
  const axes = eigenvectors(c)
  const rotation = quatOfAxes(axes)
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < points.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const t = points[i] * axes[k] + points[i + 1] * axes[3 + k] + points[i + 2] * axes[6 + k]
      lo[k] = Math.min(lo[k], t)
      hi[k] = Math.max(hi[k], t)
    }
  }
  const mid = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2)
  const center: Vec3 = [0, 1, 2].map((r) => axes[r * 3] * mid[0] + axes[r * 3 + 1] * mid[1] + axes[r * 3 + 2] * mid[2]) as Vec3
  const half: Vec3 = [0, 1, 2].map((k) => Math.max(MIN_HALF, (hi[k] - lo[k]) / 2)) as Vec3
  return { box: { center, half, rotation }, axes, volume: 8 * half[0] * half[1] * half[2] }
}

/** Where along its axis a box is cut when the points are only vertices (the middle), and where when they sample the surface (a bent pipe is cut at its bend, not at its middle). */
const MIDDLE = [0.5] as const
const ALONG = [0.15, 0.3, 0.5, 0.7, 0.85] as const

/** The points on each side of the box's axis `k`, at `along` (0 to 1) of its length. */
const cut = (points: readonly number[], fit: Fit, k: number, along: number): [number[], number[]] => {
  const a = fit.axes
  const middle = fit.box.center[0] * a[k] + fit.box.center[1] * a[3 + k] + fit.box.center[2] * a[6 + k]
  const mid = middle + (along - 0.5) * 2 * fit.box.half[k]
  const low: number[] = []
  const high: number[] = []
  for (let i = 0; i < points.length; i += 3) {
    const t = points[i] * a[k] + points[i + 1] * a[3 + k] + points[i + 2] * a[6 + k]
    ;(t < mid ? low : high).push(points[i], points[i + 1], points[i + 2])
  }
  return [low, high]
}

const fitInto = (points: readonly number[], depth: number, out: OrientedBox[], isSurface = false): void => {
  const fit = fitOne(points)
  const [thin, middle] = [...fit.box.half].sort((a, b) => a - b)
  if (depth >= MAX_DEPTH || points.length / 3 < MIN_POINTS || (!isSurface && thin <= Math.max(THICK, FAT * middle))) {
    out.push(fit.box)
    return
  }
  let best: [number[], number[]] | null = null
  let bestVolume = fit.volume * SPLIT_GAIN
  for (let k = 0; k < 3; k++) {
    for (const along of isSurface ? ALONG : MIDDLE) {
      const [low, high] = cut(points, fit, k, along)
      if (low.length < 9 || high.length < 9) continue
      const v = fitOne(low).volume + fitOne(high).volume
      if (v < bestVolume) {
        bestVolume = v
        best = [low, high]
      }
    }
  }
  if (!best) {
    out.push(fit.box)
    return
  }
  fitInto(best[0], depth + 1, out, isSurface)
  fitInto(best[1], depth + 1, out, isSurface)
}

/** Along a drawn edge longer than this (m) the surface is sampled, so a long thin solid (a pole, a beam) is not read as two plates at its ends. */
const EDGE = 0.2
/** Most samples one edge gets. */
const MAX_SAMPLES = 64
/** A mesh of more separate solids than this is fitted as one cloud: boxes are for a handful of parts, not for a hundred leaves. */
const MAX_SOLIDS = 16

/** The points with samples along every triangle edge longer than `EDGE` (`triangles`: vertex numbers of `points`, three each). */
const sampled = (points: readonly number[], triangles: readonly number[]): number[] => {
  const out = points.slice()
  for (let t = 0; t + 2 < triangles.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = triangles[t + e] * 3
      const b = triangles[t + ((e + 1) % 3)] * 3
      const length = Math.hypot(points[b] - points[a], points[b + 1] - points[a + 1], points[b + 2] - points[a + 2])
      const count = Math.min(MAX_SAMPLES, Math.ceil(length / EDGE) - 1)
      for (let i = 1; i <= count; i++) {
        const f = i / (count + 1)
        out.push(points[a] + (points[b] - points[a]) * f, points[a + 1] + (points[b + 1] - points[a + 1]) * f, points[a + 2] + (points[b + 2] - points[a + 2]) * f)
      }
    }
  }
  return out
}

/** Two vertices closer than this (m) are one: the cap of a cylinder has vertices of its own on the ring of its side. */
const WELD = 1e-4

/** The triangles grouped by the vertices they share, or sit on the same spot: each group is one drawn solid. */
const solidsOf = (points: readonly number[], triangles: readonly number[]): number[][] => {
  const parent = Array.from({ length: points.length / 3 }, (_, v) => v)
  const at = new Map<string, number>()
  for (let v = 0; v < parent.length; v++) {
    const key = `${Math.round(points[v * 3] / WELD)},${Math.round(points[v * 3 + 1] / WELD)},${Math.round(points[v * 3 + 2] / WELD)}`
    const first = at.get(key)
    if (first === undefined) at.set(key, v)
    else parent[v] = first
  }
  const find = (v: number): number => {
    let root = v
    while (parent[root] !== root) root = parent[root]
    while (parent[v] !== root) [parent[v], v] = [root, parent[v]]
    return root
  }
  for (let t = 0; t + 2 < triangles.length; t += 3) {
    parent[find(triangles[t + 1])] = find(triangles[t])
    parent[find(triangles[t + 2])] = find(triangles[t])
  }
  const groups = new Map<number, number[]>()
  for (let t = 0; t + 2 < triangles.length; t += 3) {
    const root = find(triangles[t])
    const group = groups.get(root)
    if (group) group.push(triangles[t], triangles[t + 1], triangles[t + 2])
    else groups.set(root, [triangles[t], triangles[t + 1], triangles[t + 2]])
  }
  return [...groups.values()]
}

/**
 * Boxes that hold the drawn points (x y z triples) with little air: one along their principal axes (a tilted roof sheet is a thin plate, not the 2 m tall box
 * around it), cut in two where the two halves hold them in much less (a gable's two slopes), up to `2^MAX_DEPTH` boxes. With the `triangles` they are drawn by
 * (vertex numbers of `points`, three each) each solid the triangles keep apart is fitted on its own, and the surface along each edge counts as points: a pole
 * drawn by two rings of vertices is a shaft, not two plates.
 */
export const fitOrientedBoxes = (points: readonly number[], triangles?: readonly number[]): OrientedBox[] => {
  if (points.length < 9) return []
  const out: OrientedBox[] = []
  if (!triangles || triangles.length < 3) {
    fitInto(points, 0, out)
    return out
  }
  const solids = solidsOf(points, triangles)
  const parts = solids.length > MAX_SOLIDS ? [triangles] : solids
  for (const part of parts) {
    const own: number[] = []
    const renumber = new Map<number, number>()
    const local = part.map((v) => {
      if (!renumber.has(v)) {
        renumber.set(v, own.length / 3)
        own.push(points[v * 3], points[v * 3 + 1], points[v * 3 + 2])
      }
      return renumber.get(v) as number
    })
    if (own.length >= 9) fitInto(sampled(own, local), 0, out, true)
  }
  return out
}

/** The one box along the principal axes of the points (x y z triples), uncut; null for fewer than three points. */
export const fitOrientedBox = (points: readonly number[]): OrientedBox | null => (points.length < 9 ? null : fitOne(points).box)

/**
 * Whether each corner of the box (centre, half sizes, axes as three rows of 3) has a point within `tolerance` on every axis. A side thinner than its tolerance is a plane
 * (a sheet with no thickness): its two sides are the same corners.
 */
export const hugs = (points: ArrayLike<number>, box: { readonly center: readonly number[]; readonly half: readonly number[]; readonly axes: readonly number[]; readonly tolerance: readonly number[] }): boolean => {
  const found = new Uint8Array(8)
  const a = box.axes
  let flat = 0
  for (let k = 0; k < 3; k++) if (box.half[k] <= box.tolerance[k]) flat |= 1 << k
  for (let i = 0; i < points.length; i += 3) {
    const dx = points[i] - box.center[0], dy = points[i + 1] - box.center[1], dz = points[i + 2] - box.center[2]
    let corner = 0
    let near = true
    for (let k = 0; k < 3 && near; k++) {
      const t = dx * a[k * 3] + dy * a[k * 3 + 1] + dz * a[k * 3 + 2]
      if (Math.abs(Math.abs(t) - box.half[k]) > box.tolerance[k]) near = false
      else if (t >= 0) corner |= 1 << k
    }
    if (!near) continue
    corner &= ~flat
    for (let s = flat; ; s = (s - 1) & flat) {
      found[corner | s] = 1
      if (s === 0) break
    }
  }
  for (let c = 0; c < 8; c++) if (!found[c]) return false
  return true
}
