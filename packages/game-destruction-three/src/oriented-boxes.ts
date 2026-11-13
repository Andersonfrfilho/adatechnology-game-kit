import type { Vec3 } from '@adatechnology/game-destruction'
import type { Quat } from '@adatechnology/game-physics'

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
 * is drawn between them, so a plate cut into its rows of vertices would lose the surface between them.
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

/** The points on each side of the box's middle across its axis `k`. */
const cut = (points: readonly number[], fit: Fit, k: number): [number[], number[]] => {
  const a = fit.axes
  const mid = fit.box.center[0] * a[k] + fit.box.center[1] * a[3 + k] + fit.box.center[2] * a[6 + k]
  const low: number[] = []
  const high: number[] = []
  for (let i = 0; i < points.length; i += 3) {
    const t = points[i] * a[k] + points[i + 1] * a[3 + k] + points[i + 2] * a[6 + k]
    ;(t < mid ? low : high).push(points[i], points[i + 1], points[i + 2])
  }
  return [low, high]
}

const fitInto = (points: readonly number[], depth: number, out: OrientedBox[]): void => {
  const fit = fitOne(points)
  const [thin, middle] = [...fit.box.half].sort((a, b) => a - b)
  if (depth >= MAX_DEPTH || points.length / 3 < MIN_POINTS || thin <= Math.max(THICK, FAT * middle)) {
    out.push(fit.box)
    return
  }
  let best: [number[], number[]] | null = null
  let bestVolume = fit.volume * SPLIT_GAIN
  for (let k = 0; k < 3; k++) {
    const [low, high] = cut(points, fit, k)
    if (low.length < 9 || high.length < 9) continue
    const v = fitOne(low).volume + fitOne(high).volume
    if (v < bestVolume) {
      bestVolume = v
      best = [low, high]
    }
  }
  if (!best) {
    out.push(fit.box)
    return
  }
  fitInto(best[0], depth + 1, out)
  fitInto(best[1], depth + 1, out)
}

/**
 * Boxes that hold the drawn points (x y z triples) with little air: one along their principal axes (a tilted roof sheet is a thin plate, not the 2 m tall box
 * around it), cut in two where the two halves hold them in much less (a gable's two slopes), up to `2^MAX_DEPTH` boxes.
 */
export const fitOrientedBoxes = (points: readonly number[]): OrientedBox[] => {
  if (points.length < 9) return []
  const out: OrientedBox[] = []
  fitInto(points, 0, out)
  return out
}
