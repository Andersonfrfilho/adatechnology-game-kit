import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld } from './fake-world'

describe('warm-up probes', () => {
  it('gives a mesh for the hole, patch and crack decals, each warm-up with materials of its own', () => {
    const renderer = createDestructionRenderer(THREE, { scene: new THREE.Scene(), world: new FakeWorld().asWorld() })
    const first = renderer.warmUpProbes().group as THREE.Group
    const firstMaterials = first.children.map((child) => (child as THREE.Mesh).material)
    expect(first.children).toHaveLength(3)
    expect(first.children.every((child) => !child.frustumCulled)).toBe(true)
    const second = renderer.warmUpProbes().group as THREE.Group
    const secondMaterials = second.children.map((child) => (child as THREE.Mesh).material)
    for (const material of secondMaterials) expect(firstMaterials).not.toContain(material)
  })
})
