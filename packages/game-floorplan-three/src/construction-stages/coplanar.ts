import type * as THREE from 'three'

import type { Three } from '../kernel-types.js'

/** A visible triangle of the scene, in the world, with the mesh and the material it belongs to. */
interface Triangle {
  readonly mesh: THREE.Mesh
  readonly material: THREE.Material
  readonly points: readonly THREE.Vector3[]
  readonly normal: THREE.Vector3
  readonly offset: number
}

/** What a pair of meshes overlap on one plane: the area (m²) and one spot of it. */
export interface CoplanarOverlap {
  readonly a: THREE.Mesh
  readonly b: THREE.Mesh
  area: number
  readonly at: THREE.Vector3
  readonly normal: THREE.Vector3
}

const isVisible = (o: THREE.Object3D): boolean => {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false
  return true
}

function trianglesOf(T: Three, root: THREE.Object3D, keep: (mesh: THREE.Mesh) => boolean): Triangle[] {
  root.updateMatrixWorld(true)
  const out: Triangle[] = []
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !isVisible(mesh) || !keep(mesh)) return
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.Material
    if (!material || material.colorWrite === false || material.visible === false) return
    const position = mesh.geometry.getAttribute('position')
    const index = mesh.geometry.getIndex()
    const count = index ? index.count : position.count
    for (let i = 0; i + 2 < count; i += 3) {
      const points = [0, 1, 2].map((k) => new T.Vector3().fromBufferAttribute(position, index ? index.getX(i + k) : i + k).applyMatrix4(mesh.matrixWorld))
      const normal = new T.Vector3().subVectors(points[1]!, points[0]!).cross(new T.Vector3().subVectors(points[2]!, points[0]!))
      if (normal.length() < 2e-5) continue
      normal.normalize()
      out.push({ mesh, material, points, normal, offset: normal.dot(points[0]!) })
    }
  })
  return out
}

function clip(polygon: number[][], a: number[], b: number[]): number[][] {
  const out: number[][] = []
  const side = (p: number[]): number => (b[0]! - a[0]!) * (p[1]! - a[1]!) - (b[1]! - a[1]!) * (p[0]! - a[0]!)
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i]!, q = polygon[(i + 1) % polygon.length]!
    const sp = side(p), sq = side(q)
    if (sp >= 0) out.push(p)
    if (sp >= 0 !== sq >= 0) {
      const t = sp / (sp - sq)
      out.push([p[0]! + t * (q[0]! - p[0]!), p[1]! + t * (q[1]! - p[1]!)])
    }
  }
  return out
}

const signedArea = (p: number[][]): number => p.reduce((sum, a, i) => sum + a[0]! * p[(i + 1) % p.length]![1]! - p[(i + 1) % p.length]![0]! * a[1]!, 0) / 2

/**
 * The faces of different materials that lie on one plane, facing the same way, and overlap: what the depth buffer cannot sort and the screen shows flickering
 * (z-fighting). Faces of one material on one plane draw the same colour whichever wins, and are left out. `tolerance`: how close two planes count as one.
 */
export function coplanarOverlaps(T: Three, root: THREE.Object3D, options: { readonly tolerance?: number; readonly keep?: (mesh: THREE.Mesh) => boolean; readonly minArea?: number } = {}): CoplanarOverlap[] {
  const tolerance = options.tolerance ?? 0.0015
  const triangles = trianglesOf(T, root, options.keep ?? (() => true))
  const buckets = new Map<string, Triangle[]>()
  const keyOf = (t: Triangle, dk = 0): string => `${t.normal.toArray().map((x) => Math.round(x * 200)).join(',')}|${Math.round(t.offset / tolerance) + dk}`
  for (const t of triangles) {
    const k = keyOf(t)
    const list = buckets.get(k)
    if (list) list.push(t)
    else buckets.set(k, [t])
  }
  const found = new Map<string, CoplanarOverlap>()
  for (const [k, list] of buckets) {
    const [normalKey, offsetKey] = k.split('|')
    const near = buckets.get(`${normalKey}|${Number(offsetKey) + 1}`) ?? []
    const all = list.concat(near)
    if (all.length < 2) continue
    const n = list[0]!.normal
    const u = new T.Vector3(Math.abs(n.x) > 0.9 ? 0 : 1, Math.abs(n.x) > 0.9 ? 1 : 0, 0).cross(n).normalize()
    const w = n.clone().cross(u)
    const flat = all.map((t) => {
      const p = t.points.map((q) => [q.dot(u), q.dot(w)])
      return signedArea(p) < 0 ? p.reverse() : p
    })
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i]!, b = all[j]!
        if (a.mesh === b.mesh || a.material === b.material) continue
        let polygon = flat[i]!
        const c = flat[j]!
        for (let e = 0; e < 3 && polygon.length; e++) polygon = clip(polygon, c[e]!, c[(e + 1) % 3]!)
        const area = polygon.length > 2 ? Math.abs(signedArea(polygon)) : 0
        if (area < 1e-5) continue
        const key = [a.mesh.uuid, b.mesh.uuid].sort().join('|')
        const entry = found.get(key)
        if (entry) entry.area += area
        else {
          const cx = polygon.reduce((s, p) => s + p[0]!, 0) / polygon.length, cy = polygon.reduce((s, p) => s + p[1]!, 0) / polygon.length
          found.set(key, { a: a.mesh, b: b.mesh, area, normal: n.clone(), at: u.clone().multiplyScalar(cx).addScaledVector(w, cy).addScaledVector(n, a.offset) })
        }
      }
    }
  }
  const minArea = options.minArea ?? 1e-4
  return [...found.values()].filter((o) => o.area >= minArea).sort((x, y) => y.area - x.area)
}
