import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createGroundField } from '@adatechnology/game-vfx'
import type { MarkEvent, MeshParticle, MeshPool } from '@adatechnology/game-vfx'
import { createMarkLayer } from '../src/marks'
import { createMeshLayer } from '../src/mesh-layer'
import { createFakeCanvas } from './fake-canvas'

function particle(id: number, overrides: Partial<MeshParticle> = {}): MeshParticle {
  return {
    id, shape: 'sphere', radius: 0.2 + (id % 7) * 0.1, height: 1, segments: 10, segments2: 8, color: 0x808080, additive: false, lit: true,
    x: 0, y: 0, z: 0, frame: [0, 0, 0, 1], at: [0, 0, 0], rx: 0, ry: 0, rz: 0, scale: 1, opacity: 0.5, age: 0, life: 1, vx: 0, vy: 0, vz: 0, spin: [0, 0, 0], gravity: 0,
    ...overrides,
  } as MeshParticle
}

const geometriesIn = (group: THREE.Group): Set<THREE.BufferGeometry> => new Set((group.children as THREE.Mesh[]).map((mesh) => mesh.geometry))

describe('the solid particles reuse what they were drawn with', () => {
  it('particles born and dying over many frames add no geometry and few materials', () => {
    const pool = { particles: [] as MeshParticle[], count: 0 }
    const layer = createMeshLayer(THREE, pool as unknown as MeshPool)
    const geometries = new Set<THREE.BufferGeometry>()
    const materials = new Set<THREE.Material>()
    for (let frame = 0; frame < 120; frame++) {
      pool.particles = Array.from({ length: 12 }, (_, slot) => particle(frame * 12 + slot, { additive: slot % 3 === 0, lit: slot % 3 === 1 }))
      pool.count = pool.particles.length
      layer.sync()
      for (const mesh of layer.group.children as THREE.Mesh[]) {
        geometries.add(mesh.geometry)
        materials.add(mesh.material as THREE.Material)
      }
    }
    expect(layer.group.children.length).toBe(12)
    expect(geometries.size).toBe(1)
    expect(materials.size).toBeLessThanOrEqual(24)
    layer.dispose()
  })

  it('draws a particle at its radius although the geometry is one unit shape', () => {
    const pool = { particles: [particle(1, { radius: 0.5, scale: 2 })], count: 1 }
    const layer = createMeshLayer(THREE, pool as unknown as MeshPool)
    layer.sync()
    const mesh = layer.group.children[0] as THREE.Mesh
    expect(mesh.scale.x).toBeCloseTo(1)
    expect((mesh.geometry as THREE.SphereGeometry).parameters.radius).toBe(1)
  })
})

describe('the marks on the ground are bounded', () => {
  const options = { ground: createGroundField(), createCanvas: createFakeCanvas, rockGeometry: new THREE.DodecahedronGeometry(0.5, 0), plateGeometry: new THREE.BoxGeometry(1, 1, 1) }
  const scorch = (x: number): MarkEvent => ({ type: 'add', mark: { kind: 'scorch', x, z: 0, radius: 1, variant: 0, lift: 0.01, rotation: 0 } })
  const rock = (index: number): MarkEvent => ({ type: 'add', mark: { kind: 'rock', x: index, y: 0, z: 0, scale: [1, 1, 1], rotation: [0, 0, 0], plate: false, color: 0x303030 + index } })

  it('keeps no more ground marks than the cap and builds no new geometry once it is reached', () => {
    const layer = createMarkLayer(THREE, { ...options, maxGroundMarks: 4 })
    const created = new Set<THREE.BufferGeometry>()
    for (let index = 0; index < 40; index++) {
      layer.handle(scorch(index))
      for (const geometry of geometriesIn(layer.group)) created.add(geometry)
    }
    const planes = (layer.group.children as THREE.Mesh[]).filter((child) => child.geometry?.type === 'PlaneGeometry')
    expect(planes.length).toBe(4)
    // the three instanced meshes' own geometries plus the four planes
    expect(created.size).toBeLessThanOrEqual(4 + 3)
    const newest = planes.at(-1)!.geometry.getAttribute('position')
    expect(newest.getX(0)).toBeCloseTo(39 - 1)
  })

  it('draws every rock as an instance, overwrites the oldest past the cap, and clears', () => {
    const layer = createMarkLayer(THREE, { ...options, maxRocks: 8 })
    for (let index = 0; index < 20; index++) layer.handle(rock(index))
    const rocks = (layer.group.children as THREE.InstancedMesh[]).find((child) => child.isInstancedMesh && child.count > 0)!
    expect(rocks.count).toBe(8)
    expect(layer.count()).toBe(1)
    layer.handle({ type: 'clear' })
    expect(layer.count()).toBe(0)
  })
})
