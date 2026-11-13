import { dominantAxis, normalOf, overlapOfTriangles, projectTriangle, unprojectPoint } from './coincident-geometry'
import type { Triangle, Vec3 } from './coincident-geometry'
import { boxOf, depthResolution } from './coincident-types'
import type { CoincidentBatch, CoincidentFaceHit, CoincidentFacesOptions } from './coincident-types'

interface NearFace {
  readonly triangle: Triangle
  readonly n: Vec3
  readonly offset: number
  readonly label: string
  readonly doubleSided: boolean
  readonly box: readonly [number, number, number, number, number, number]
  readonly batch: CoincidentBatch
  readonly batchIndex: number
  /** The triangle's three vertex indices in its batch. */
  readonly corners: readonly [number, number, number]
}

/** Shading closer than this (a 256th of a colour step, a thousandth of a texture repeat) is the same pixel. */
const SAME_COLOUR = 1 / 512
const SAME_UV = 1e-3
const SAME_FACING = 1 - 1e-6

const PARALLEL = Math.cos((2 * Math.PI) / 180) // under 2° apart counts as parallel
const DEFAULT_MAX_PER_PAIR = 3

/** Pairs are counted by kind of part: `wall_12` and `wall_3` are one pair, so one broken kind does not drown the rest. */
const kindOf = (label: string): string => label.replace(/\d+(\.\d+)?/g, '#')

function facesOf(batches: readonly CoincidentBatch[]): NearFace[] {
  const faces: NearFace[] = []
  batches.forEach((batch, index) => {
    const label = batch.label ?? `batch ${index}`
    const { positions: p, indices } = batch
    const count = indices ? indices.length : p.length / 3
    const vertex = (i: number): Vec3 => [p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!]
    for (let i = 0; i + 2 < count; i += 3) {
      const corners: [number, number, number] = indices ? [indices[i]!, indices[i + 1]!, indices[i + 2]!] : [i, i + 1, i + 2]
      const triangle: Triangle = [vertex(corners[0]), vertex(corners[1]), vertex(corners[2])]
      const n = normalOf(triangle)
      if (n[0] === 0 && n[1] === 0 && n[2] === 0) continue
      const offset = n[0] * triangle[0][0] + n[1] * triangle[0][1] + n[2] * triangle[0][2]
      faces.push({ triangle, n, offset, label, doubleSided: batch.doubleSided === true, box: boxOf(triangle), batch, batchIndex: index, corners })
    }
  })
  return faces
}

/** Barycentric weights of `point` (on the triangle's plane) in the triangle. */
function weightsOf(t: Triangle, n: Vec3, point: Vec3): Vec3 {
  const area = (a: Vec3, b: Vec3, c: Vec3): number => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
    return n[0] * (uy * vz - uz * vy) + n[1] * (uz * vx - ux * vz) + n[2] * (ux * vy - uy * vx)
  }
  const whole = area(t[0], t[1], t[2]) || 1
  return [area(point, t[1], t[2]) / whole, area(t[0], point, t[2]) / whole, area(t[0], t[1], point) / whole]
}

/** A per-vertex attribute of `size` components, interpolated at `point`. */
function attributeAt(values: ArrayLike<number>, size: number, face: NearFace, point: Vec3): number[] {
  const w = weightsOf(face.triangle, face.n, point)
  return Array.from({ length: size }, (_, k) => w[0] * values[face.corners[0] * size + k]! + w[1] * values[face.corners[1] * size + k]! + w[2] * values[face.corners[2] * size + k]!)
}

const close = (a: readonly number[], b: readonly number[], tolerance: number): boolean => a.every((v, k) => Math.abs(v - b[k]!) <= tolerance)

/** Two faces of one look, facing exactly alike, with the same colour and texture where they overlap: whichever wins the depth test, the pixel is the same. */
function drawAlike(a: NearFace, b: NearFace, point: Vec3): boolean {
  if (a.batch.look === undefined || a.batch.look !== b.batch.look) return false
  if (a.n[0] * b.n[0] + a.n[1] * b.n[1] + a.n[2] * b.n[2] < SAME_FACING) return false
  const ca = a.batch.colors, cb = b.batch.colors
  if ((ca === undefined) !== (cb === undefined)) return false
  if (ca && cb && !close(attributeAt(ca, 3, a, point), attributeAt(cb, 3, b, point), SAME_COLOUR)) return false
  const ua = a.batch.uvs, ub = b.batch.uvs
  if ((ua === undefined) !== (ub === undefined)) return false
  return !(ua && ub && !close(attributeAt(ua, 2, a, point), attributeAt(ub, 2, b, point), SAME_UV))
}

function touch(a: NearFace['box'], b: NearFace['box'], slack: number): boolean {
  return a[1] <= b[4] + slack && b[1] <= a[4] + slack && a[2] <= b[5] + slack && b[2] <= a[5] + slack && a[0] <= b[3] + slack && b[0] <= a[3] + slack
}

function nearHit(a: NearFace, b: NearFace, eps: number, minArea: number): CoincidentFaceHit | undefined {
  const facing = a.n[0] * b.n[0] + a.n[1] * b.n[1] + a.n[2] * b.n[2]
  if (Math.abs(facing) < PARALLEL) return undefined
  if (facing < 0 && !(a.doubleSided || b.doubleSided)) return undefined
  const drop = dominantAxis(a.n)
  const overlap = overlapOfTriangles(projectTriangle(a.triangle, drop), projectTriangle(b.triangle, drop))
  if (!overlap || overlap.area < minArea) return undefined
  const point = unprojectPoint(overlap.center, drop, a)
  const separation = Math.abs(b.n[0] * point[0] + b.n[1] * point[1] + b.n[2] * point[2] - b.offset)
  if (separation >= eps) return undefined
  if (facing > 0 && drawAlike(a, b, point)) return undefined
  return { normal: a.n, offset: a.offset, area: overlap.area, point, labelA: a.label, labelB: b.label, batchA: a.batchIndex, batchB: b.batchIndex, kind: facing > 0 ? 'coplanar' : 'opposed', separation }
}

const CELL = 2 // metres
const LARGE_CELLS = 64 // a face spanning more cells than this (a terrain triangle) is compared with everything instead of being binned

/** Boxes binned into a grid of 2 m cells: a face is only compared with the faces sharing a cell, so a house of 10^5 faces costs about 10^6 pair tests, not 10^10. */
export function nearCoincidentFaces(batches: readonly CoincidentBatch[], options: CoincidentFacesOptions): CoincidentFaceHit[] {
  const eps = depthResolution(options.depth)
  const minArea = options.minArea ?? 1e-4
  const maxHits = options.maxHits ?? 200
  const maxPerPair = options.maxPerPair ?? DEFAULT_MAX_PER_PAIR
  const faces = facesOf(batches)
  const perPair = new Map<string, number>()
  const hits: CoincidentFaceHit[] = []
  const cells = new Map<number, number[]>()
  const large: number[] = []
  const seen = new Int32Array(faces.length).fill(-1)
  const cellKey = (x: number, y: number, z: number): number => ((x + 4096) * 8192 + (y + 4096)) * 8192 + (z + 4096)
  const range = (lo: number, hi: number): [number, number] => [Math.floor((lo - eps) / CELL), Math.floor((hi + eps) / CELL)]

  const consider = (index: number, otherIndex: number): boolean => {
    const face = faces[index]!, other = faces[otherIndex]!
    if (Math.abs(face.n[0] * other.n[0] + face.n[1] * other.n[1] + face.n[2] * other.n[2]) < PARALLEL) return false
    if (!touch(other.box, face.box, eps)) return false
    const hit = nearHit(other, face, eps, minArea)
    if (!hit) return false
    const [first, second] = [kindOf(other.label), kindOf(face.label)].sort()
    const key = `${first}|${second}|${hit.kind}`
    const count = perPair.get(key) ?? 0
    if (count >= maxPerPair) return false
    perPair.set(key, count + 1)
    hits.push(hit)
    return hits.length >= maxHits
  }

  for (let index = 0; index < faces.length; index++) {
    const face = faces[index]!
    const [x0, x1] = range(face.box[0], face.box[3]), [y0, y1] = range(face.box[1], face.box[4]), [z0, z1] = range(face.box[2], face.box[5])
    const span = (x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1)
    if (span > LARGE_CELLS) {
      for (let other = 0; other < index; other++) if (consider(index, other)) return hits
      large.push(index)
      continue
    }
    for (const otherIndex of large) if (consider(index, otherIndex)) return hits
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      const key = cellKey(x, y, z)
      const list = cells.get(key)
      if (!list) { cells.set(key, [index]); continue }
      for (const otherIndex of list) {
        if (seen[otherIndex] === index) continue
        seen[otherIndex] = index
        if (consider(index, otherIndex)) return hits
      }
      list.push(index)
    }
  }
  return hits
}
