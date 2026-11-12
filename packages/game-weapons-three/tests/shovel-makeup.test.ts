import { itemModels, makeupSpec } from '@adatechnology/game-items-three'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { buildModeledProp, modeledPropSpec } from '../src'

describe('the shovel of the weapons counter has the make-up of the shovel of the goods', () => {
  const def = { id: 'shovel', mass: 2 }
  const prop = buildModeledProp(THREE, def, 'Shovel', undefined, itemModels)!

  it('is the same two parts and the rivets, named for the counter', () => {
    const spec = modeledPropSpec(prop, def, 'Shovel')
    const goods = makeupSpec('shovel', ['weapon'])!
    expect(spec).toEqual({ ...goods, name: 'Shovel' })
    expect(spec.parts.map((p) => p.id)).toEqual(['handle', 'blade'])
    expect(spec.parts.reduce((sum, p) => sum + (p.mass ?? 0), 0)).toBeCloseTo(def.mass, 6)
  })

  it('has every merged mesh bound to a part of the spec, the wood to the handle and the steel to the blade', () => {
    const meshes: THREE.Mesh[] = []
    prop.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh))
    expect(meshes.length).toBeGreaterThan(1)
    const ids = new Set(meshes.map((m) => m.userData.destructionPart as string))
    expect(ids).toEqual(new Set(['handle', 'blade']))
  })

  it('lies on the floor in the frame of the spec: the handle box holds the drawn shaft', () => {
    const spec = modeledPropSpec(prop, def, 'Shovel')
    const handle = spec.parts[0]!
    const size = handle.shape.kind === 'box' ? handle.shape.size : [0, 0, 0]
    const drawn = new THREE.Box3()
    prop.updateMatrixWorld(true)
    prop.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh && mesh.userData.destructionPart === 'handle') drawn.union(new THREE.Box3().setFromObject(mesh))
    })
    expect(drawn.min.y).toBeGreaterThanOrEqual(handle.position[1] - size[1] / 2 - 0.01)
    expect(drawn.max.y).toBeLessThanOrEqual(handle.position[1] + size[1] / 2 + 0.01)
    expect(drawn.min.x).toBeGreaterThanOrEqual(handle.position[0] - size[0] / 2 - 0.01)
  })
})
