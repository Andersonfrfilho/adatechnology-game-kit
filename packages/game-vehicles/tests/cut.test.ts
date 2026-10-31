import { describe, expect, it } from 'vitest'
import { makeKit } from './helpers/kit'
import { referenceCrease } from './helpers/crease-reference'
import { referenceCutGeometry } from './helpers/cut-reference'
import { triIndexOf } from '../src/tri-index'

function boxTest(THREE: any, lo: number[], hi: number[], sel: boolean) {
  const n = new THREE.Vector3()
  return {
    tag: 'part',
    sel: sel ? (normal: any) => n.copy(normal).dot(new THREE.Vector3(0, 1, 0)) > 0.3 : null,
    sdf: (x: number, y: number, z: number) => Math.max(lo[0] - x, x - hi[0], lo[1] - y, y - hi[1], lo[2] - z, z - hi[2]),
  }
}

function same(a: any, b: any) {
  expect(Object.keys(a.attributes).sort()).toEqual(Object.keys(b.attributes).sort())
  for (const k of Object.keys(a.attributes)) expect(Array.from(a.attributes[k].array)).toEqual(Array.from(b.attributes[k].array))
}

describe('cutGeometry', () => {
  it('matches the reference bit for bit, with and without bounds, on indexed and non-indexed geometry', () => {
    const kit: any = makeKit()
    const THREE = kit.THREE
    const crease = (g: any, d: any) => referenceCrease(THREE, g, d)
    const shapes = [new THREE.SphereGeometry(1, 40, 28), new THREE.BoxGeometry(2, 1, 1, 8, 4, 4), new THREE.TorusGeometry(1, 0.3, 12, 40).toNonIndexed()]
    const regions = [
      { lo: [-0.3, -0.4, -2], hi: [0.5, 0.6, 2] },
      { lo: [0.2, 0.1, 0.1], hi: [0.4, 0.3, 0.9] },
      { lo: [5, 5, 5], hi: [6, 6, 6] },
      { lo: [-9, -9, -9], hi: [9, 9, 9] },
    ]
    for (const base of shapes) {
      for (const r of regions) {
        for (const sel of [false, true]) {
          const test = boxTest(THREE, r.lo, r.hi, sel)
          const want = referenceCutGeometry(THREE, base, [test], crease)
          const slow = kit._.cutGeometry(base, [test])
          const fast = kit._.cutGeometry(base, [{ ...test, bounds: { lo: r.lo.map((x) => x - 1e-3), hi: r.hi.map((x) => x + 1e-3) } }])
          for (const got of [slow, fast]) {
            same(got.geo, want.geo)
            expect(Object.keys(got.cut)).toEqual(Object.keys(want.cut))
            for (const k of Object.keys(want.cut)) same(got.cut[k], want.cut[k])
          }
          const kept = triIndexOf(fast.geo)!
          const fresh = triIndexOf(fast.geo.clone())!
          expect(Array.from(kept.boxes)).toEqual(Array.from(fresh.boxes))
          expect(Array.from(kept.blocks)).toEqual(Array.from(fresh.blocks))
        }
      }
    }
  })
})
