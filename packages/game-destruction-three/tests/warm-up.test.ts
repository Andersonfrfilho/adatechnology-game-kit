import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld } from './fake-world'

describe('warm-up probes', () => {
  it('gives a mesh for the hole, patch and crack decals, each warm-up with materials of its own', () => {
    const renderer = createDestructionRenderer(THREE, { scene: new THREE.Scene(), world: new FakeWorld().asWorld() })
    const first = renderer.warmUpProbes().group as THREE.Group
    const firstMaterials = first.children.map((child) => (child as THREE.Mesh).material)
    expect(first.children.length).toBeGreaterThanOrEqual(3)
    expect(first.children.every((child) => !child.frustumCulled)).toBe(true)
    const second = renderer.warmUpProbes().group as THREE.Group
    // the decal materials are made again each time; the fragment materials and geometries are shared and stay
    const decalMaterials = (group: THREE.Group): unknown[] => group.children.slice(0, 3).map((child) => (child as THREE.Mesh).material)
    for (const material of decalMaterials(second)) expect(decalMaterials(first)).not.toContain(material)
    expect(firstMaterials.length).toBe(first.children.length)
  })

  it('draws every shared piece of a fragment once: the box, the six shards, the bullet-hole disc, opaque and glass', () => {
    const renderer = createDestructionRenderer(THREE, { scene: new THREE.Scene(), world: new FakeWorld().asWorld() })
    const group = renderer.warmUpProbes().group as THREE.Group
    const fragmentMeshes = group.children.slice(3) as THREE.Mesh[]
    const geometries = new Set(fragmentMeshes.map((mesh) => mesh.geometry))
    expect(geometries.size).toBe(8)
    expect(fragmentMeshes.filter((mesh) => (mesh.material as THREE.Material).transparent)).toHaveLength(7)
    const again = (renderer.warmUpProbes().group as THREE.Group).children.slice(3) as THREE.Mesh[]
    expect(new Set(again.map((mesh) => mesh.geometry))).toEqual(geometries)
    for (const geometry of geometries) expect(geometry.getAttribute('position').count).toBeGreaterThan(0)
  })
})
