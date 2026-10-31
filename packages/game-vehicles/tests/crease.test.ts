import { describe, expect, it } from 'vitest'
import { makeKit } from './helpers/kit'
import { referenceCrease } from './helpers/crease-reference'

describe('crease', () => {
  it('matches the reference smoothing bit for bit on indexed and non-indexed geometry', () => {
    const kit: any = makeKit()
    const THREE = kit.THREE
    const shapes = [new THREE.SphereGeometry(1, 24, 16), new THREE.BoxGeometry(2, 1, 1, 6, 3, 3), new THREE.TorusGeometry(1, 0.3, 12, 30).toNonIndexed(), new THREE.CylinderGeometry(0.4, 1, 2, 18)]
    for (const deg of [30, 42, 60]) {
      for (const base of shapes) {
        const a = base.clone()
        const b = base.clone()
        kit._.crease(a, deg)
        referenceCrease(THREE, b, deg)
        expect(Array.from(a.attributes.normal.array)).toEqual(Array.from(b.attributes.normal.array))
      }
    }
  })

  it('a one-shot crease leaves the normal attribute as untouched as the old one did (its version is part of the exact goldens)', () => {
    const kit: any = makeKit()
    const geometry = new kit.THREE.SphereGeometry(1, 12, 8)
    kit._.crease(geometry, 42)
    expect(geometry.attributes.normal.version).toBe(0)
  })

  it('a sliced crease marks the normals for upload, since the flat ones may already be on the GPU', () => {
    const kit: any = makeKit()
    const geometry = new kit.THREE.SphereGeometry(1, 12, 8)
    const task = kit._.creaseTask(geometry, 42)
    let finished = false
    while (!finished) finished = task.step(performance.now() + 1)
    expect(geometry.attributes.normal.version).toBeGreaterThan(0)
  })
})
