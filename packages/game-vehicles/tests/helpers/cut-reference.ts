/* The cutGeometry of the kit before the untouched triangles skipped the per-triangle work, kept as the reference the new one must match bit for bit. */
import type { BufferGeometry } from 'three'

import type { CutTest } from '../../src/geometry'
import type { Three } from '../../src/types'

/** A triangle: its three vertices, each the attributes (position, then colour and uv) one after the other. */
type Tri = number[][]

export function referenceCutGeometry(
  THREE: Three,
  geo: BufferGeometry,
  tests: readonly CutTest[],
  crease: (g: BufferGeometry, deg: number) => BufferGeometry,
): { geo: BufferGeometry; cut: Record<string, BufferGeometry> } {
  const V3 = THREE.Vector3
  const src = geo.index ? geo.toNonIndexed() : geo
  const names = ['position'].concat(
    ['color', 'uv'].filter(function (n) {
      return !!src.attributes[n]
    }),
  )
  const sizes = names.map(function (n) {
    return src.attributes[n].itemSize
  })
  const arrs = names.map(function (n) {
    return src.attributes[n].array
  })
  const nv = src.attributes.position.count
  let tris: Tri[] = []
  for (let f = 0; f < nv; f += 3) {
    const t: Tri = []
    for (let k = 0; k < 3; k++) {
      const v: number[] = []
      for (let a = 0; a < names.length; a++) for (let q = 0; q < sizes[a]; q++) v.push(arrs[a][(f + k) * sizes[a] + q])
      t.push(v)
    }
    tris.push(t)
  }
  const cut: Record<string, Tri[]> = {}
  const n = new V3()
  const e1 = new V3()
  const e2 = new V3()
  const ce = new V3()
  function lerp(P: number[], Q: number[], k: number): number[] {
    const o: number[] = new Array(P.length)
    for (let i = 0; i < P.length; i++) o[i] = P[i] + (Q[i] - P[i]) * k
    return o
  }
  function clip(t: Tri, d: number[], s: number): Tri {
    const out: Tri = []
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3
      const di = s * d[i]
      const dj = s * d[j]
      if (di >= 0) out.push(t[i])
      if (di >= 0 !== dj >= 0) out.push(lerp(t[i], t[j], di / (di - dj)))
    }
    return out
  }
  function fan(poly: Tri, arr: Tri[]) {
    for (let i = 1; i < poly.length - 1; i++) arr.push([poly[0], poly[i], poly[i + 1]])
  }
  tests.forEach(function (T) {
    const next: Tri[] = []
    const rem = T.tag ? (cut[T.tag] = cut[T.tag] || []) : null
    tris.forEach(function (t) {
      const A = t[0]
      const B = t[1]
      const C = t[2]
      e1.set(B[0] - A[0], B[1] - A[1], B[2] - A[2])
      e2.set(C[0] - A[0], C[1] - A[1], C[2] - A[2])
      n.crossVectors(e1, e2)
      const len = n.length()
      if (len < 1e-12) {
        next.push(t)
        return
      }
      n.multiplyScalar(1 / len)
      ce.set((A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3)
      if (T.sel && !T.sel(n, ce)) {
        next.push(t)
        return
      }
      const d = [T.sdf(A[0], A[1], A[2]), T.sdf(B[0], B[1], B[2]), T.sdf(C[0], C[1], C[2])]
      const ins = (d[0] < 0 ? 1 : 0) + (d[1] < 0 ? 1 : 0) + (d[2] < 0 ? 1 : 0)
      if (ins === 0) next.push(t)
      else if (ins === 3) {
        if (rem) rem.push(t)
      } else {
        fan(clip(t, d, 1), next)
        if (rem) fan(clip(t, d, -1), rem)
      }
    })
    tris = next
  })
  function build(list: Tri[]) {
    const g = new THREE.BufferGeometry()
    let off = 0
    names.forEach(function (nm, a) {
      const arr = new Float32Array(list.length * 3 * sizes[a])
      let w = 0
      list.forEach(function (t) {
        for (let k = 0; k < 3; k++) for (let q = 0; q < sizes[a]; q++) arr[w++] = t[k][off + q]
      })
      g.setAttribute(nm, new THREE.BufferAttribute(arr, sizes[a]))
      off += sizes[a]
    })
    g.userData.crease = true
    return g
  }
  const out: { geo: BufferGeometry; cut: Record<string, BufferGeometry> } = { geo: build(tris), cut: {} }
  Object.keys(cut).forEach(function (k) {
    out.cut[k] = crease(build(cut[k]), 42)
  })
  return out
}
