import { dominantAxis, normalOf, overlapOfTriangles, projectTriangle, unprojectPoint } from './coincident-geometry'
import type { Triangle, Vec3 } from './coincident-geometry'

/** One draw batch with its triangles already in world space (metres). */
export interface CoincidentBatch {
  readonly positions: ArrayLike<number>
  readonly indices?: ArrayLike<number>
  /** Names the batch in the report: mesh name, part, material. */
  readonly label?: string
}

export interface CoincidentFacesOptions {
  /** Two parallel faces nearer than this (metres) are on the same plane and z-fight. Default 0.001. */
  readonly eps?: number
  /** Overlaps smaller than this (m²) are edge contacts nobody sees. Default 1e-4 (one square centimetre). */
  readonly minArea?: number
  /** Stop after this many hits (a broken house can have thousands). Default 200. */
  readonly maxHits?: number
}

/** Two triangles on the same plane, facing the same way, that overlap: the renderer flickers between them. */
export interface CoincidentFaceHit {
  readonly normal: Vec3
  readonly offset: number
  readonly area: number
  /** A point inside the overlap, in world space. */
  readonly point: Vec3
  readonly labelA: string
  readonly labelB: string
  /** Index in the input of the batch of each triangle. */
  readonly batchA: number
  readonly batchB: number
}

interface Face {
  readonly triangle: Triangle
  readonly n: Vec3
  readonly offset: number
  readonly label: string
  readonly batch: number
  readonly box: readonly [number, number, number, number, number, number]
}

const NORMAL_STEP = 0.002 // about 0.1°: normals closer than this share a direction bucket

function trianglesOf(batch: CoincidentBatch): Triangle[] {
  const { positions: p, indices } = batch
  const vertex = (i: number): Vec3 => [p[i * 3]!, p[i * 3 + 1]!, p[i * 3 + 2]!]
  const count = indices ? indices.length : p.length / 3
  const out: Triangle[] = []
  for (let i = 0; i + 2 < count; i += 3) {
    out.push(indices ? [vertex(indices[i]!), vertex(indices[i + 1]!), vertex(indices[i + 2]!)] : [vertex(i), vertex(i + 1), vertex(i + 2)])
  }
  return out
}

function directionKey(n: Vec3): string {
  return n.map((c) => Math.round(c / NORMAL_STEP)).join(',')
}

function boxOf(t: Triangle): Face['box'] {
  const xs = [t[0][0], t[1][0], t[2][0]], ys = [t[0][1], t[1][1], t[2][1]], zs = [t[0][2], t[1][2], t[2][2]]
  return [Math.min(...xs), Math.min(...ys), Math.min(...zs), Math.max(...xs), Math.max(...ys), Math.max(...zs)]
}

function boxesTouch(a: Face['box'], b: Face['box'], slack: number): boolean {
  return a[0] <= b[3] + slack && b[0] <= a[3] + slack && a[1] <= b[4] + slack && b[1] <= a[4] + slack && a[2] <= b[5] + slack && b[2] <= a[5] + slack
}

function bucketFaces(batches: readonly CoincidentBatch[], eps: number): Map<string, Face[]> {
  const buckets = new Map<string, Face[]>()
  batches.forEach((batch, index) => {
    const label = batch.label ?? `batch ${index}`
    for (const triangle of trianglesOf(batch)) {
      const n = normalOf(triangle)
      if (n[0] === 0 && n[1] === 0 && n[2] === 0) continue
      const offset = n[0] * triangle[0][0] + n[1] * triangle[0][1] + n[2] * triangle[0][2]
      const key = `${directionKey(n)}|${Math.floor(offset / eps)}`
      const list = buckets.get(key) ?? []
      list.push({ triangle, n, offset, label, batch: index, box: boxOf(triangle) })
      buckets.set(key, list)
    }
  })
  return buckets
}

function overlapHit(a: Face, b: Face, minArea: number): CoincidentFaceHit | undefined {
  const drop = dominantAxis(a.n)
  const overlap = overlapOfTriangles(projectTriangle(a.triangle, drop), projectTriangle(b.triangle, drop))
  if (!overlap || overlap.area < minArea) return undefined
  const point = unprojectPoint(overlap.center, drop, a)
  return { normal: a.n, offset: a.offset, area: overlap.area, point, labelA: a.label, labelB: b.label, batchA: a.batch, batchB: b.batch }
}

/**
 * Finds triangles on the same plane (within `eps`), facing the same way, that overlap. They sit at the same depth, so the GPU flickers
 * between them as the camera moves (z-fighting). Works on any geometry: boxes, extrusions, CSG, meshes, whatever built the triangles.
 */
export function coincidentFaces(batches: readonly CoincidentBatch[], options: CoincidentFacesOptions = {}): CoincidentFaceHit[] {
  const eps = options.eps ?? 0.001
  const minArea = options.minArea ?? 1e-4
  const maxHits = options.maxHits ?? 200
  const buckets = bucketFaces(batches, eps)
  const hits: CoincidentFaceHit[] = []
  for (const [key, faces] of buckets) {
    const [direction, slot] = key.split('|') as [string, string]
    const next = buckets.get(`${direction}|${Number(slot) + 1}`) ?? []
    for (let i = 0; i < faces.length; i++) {
      const a = faces[i]!
      for (let j = i + 1; j < faces.length + next.length; j++) {
        const b = j < faces.length ? faces[j]! : next[j - faces.length]!
        if (Math.abs(a.offset - b.offset) > eps || !boxesTouch(a.box, b.box, eps)) continue
        const hit = overlapHit(a, b, minArea)
        if (hit) hits.push(hit)
        if (hits.length >= maxHits) return hits
      }
    }
  }
  return hits
}

/** One line per hit, for a test failure message: where it is and which two pieces fight. */
export function describeCoincidentFaces(hits: readonly CoincidentFaceHit[], limit = 12): string {
  const lines = hits.slice(0, limit).map((h) => {
    const at = h.point.map((c) => c.toFixed(3)).join(', ')
    const facing = h.normal.map((c) => c.toFixed(2)).join(', ')
    return `  ${h.labelA} × ${h.labelB} at (${at}) facing (${facing}), ${(h.area * 1e4).toFixed(1)} cm²`
  })
  if (hits.length > limit) lines.push(`  … and ${hits.length - limit} more`)
  return lines.join('\n')
}
