import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { liveTriIndex, touchTriIndex, triIndexOf } from '../src/tri-index'

describe('triangle index', () => {
  it('after touching moved vertices equals a fresh build, and a plain change of the positions drops it', () => {
    const geo = new THREE.SphereGeometry(1, 30, 20).toNonIndexed()
    const first = triIndexOf(geo)!
    const live = liveTriIndex(geo)!
    expect(live).toBe(first)
    const pos = geo.attributes.position!
    const moved = [3, 4, 5, 100, 1001, 2000]
    for (const v of moved) pos.setXYZ(v, pos.getX(v) + 0.7, pos.getY(v) - 0.2, pos.getZ(v) + 0.1)
    pos.needsUpdate = true
    touchTriIndex(geo, live, moved)
    const fresh = triIndexOf(geo.clone())!
    expect(triIndexOf(geo)).toBe(first)
    expect(Array.from(first.boxes)).toEqual(Array.from(fresh.boxes))
    expect(Array.from(first.blocks)).toEqual(Array.from(fresh.blocks))
    pos.setX(7, 5)
    pos.needsUpdate = true
    expect(liveTriIndex(geo)).toBeUndefined()
    expect(Array.from(triIndexOf(geo)!.boxes)).toEqual(Array.from(triIndexOf(geo.clone())!.boxes))
  })
})
