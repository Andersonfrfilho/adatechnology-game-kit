import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { buildItem, itemMakeup, makeupSpec } from '../src'

const SHOVEL = { id: 'shovel', category: 'tools', size: [1.1, 0.07, 0.22] as [number, number, number], model: 'shovel', weight: 2 }

describe('the make-up of a shovel', () => {
  const spec = makeupSpec('shovel')!

  it('is a 2 kg tool: a hardwood handle along its grain riveted to a pressed steel blade', () => {
    const [handle, blade] = [spec.parts.find((p) => p.id === 'handle')!, spec.parts.find((p) => p.id === 'blade')!]
    expect(handle).toMatchObject({ material: 'wood_hard', grain: 'x' })
    expect(blade).toMatchObject({ material: 'steel', thickness: 0.002 })
    expect(handle.mass! + blade.mass!).toBeCloseTo(2, 6)
    // a round ash handle of 3.5 cm: its volume at hardwood density is about its mass
    const [length, width, depth] = handle.shape.kind === 'box' ? handle.shape.size : [0, 0, 0]
    expect(length).toBeGreaterThanOrEqual(0.9)
    expect(Math.PI * (width / 2) * (depth / 2) * length * 750).toBeCloseTo(handle.mass!, 0)
    expect(spec.joints).toEqual([expect.objectContaining({ a: 'handle', b: 'blade', kind: 'bolt', strength: 400 })])
  })

  it('hands out a copy each time, so a world owns its own', () => {
    expect(makeupSpec('shovel')).not.toBe(spec)
    expect(makeupSpec('shovel', ['weapon'])!.tags).toEqual(expect.arrayContaining(['tool', 'weapon']))
    expect(itemMakeup('soda_can')).toBeUndefined()
  })

  it('binds every drawn mesh of the shovel to a part, wood to the handle and metal to the blade, inside the part boxes', () => {
    const { root } = buildItem(THREE, SHOVEL, { destructible: true })
    root.updateMatrixWorld(true)
    const parts = new Map(spec.parts.map((p) => [p.id, p]))
    const meshes: THREE.Mesh[] = []
    root.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh))
    for (const mesh of meshes) {
      const id = mesh.userData.destructionPart as string
      expect(parts.has(id)).toBe(true)
      expect(mesh.userData.destructionMaterial).toBe(parts.get(id)!.material)
      expect(id).toBe(parts.get(id)!.material === 'steel' ? 'blade' : 'handle')
    }
    // the spec is in the frame of the built item: the drawn handle shaft lies inside the box of the handle part
    const handle = parts.get('handle')!
    const size = handle.shape.kind === 'box' ? handle.shape.size : [0, 0, 0]
    const box = new THREE.Box3()
    for (const mesh of meshes.filter((m) => m.userData.destructionPart === 'handle')) box.union(new THREE.Box3().setFromObject(mesh))
    expect(box.min.x).toBeGreaterThanOrEqual(handle.position[0] - size[0] / 2 - 0.01)
    expect(box.min.y).toBeGreaterThanOrEqual(handle.position[1] - size[1] / 2 - 0.01)
    expect(box.max.y).toBeLessThanOrEqual(handle.position[1] + size[1] / 2 + 0.01)
  })
})
