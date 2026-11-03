import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { raycastIndexed } from '../src/tri-index'

/** A small deterministic generator: the same rays on every run. */
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

function scene(): THREE.Group {
  const root = new THREE.Group()
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.8, 0.25, 120, 16), new THREE.MeshBasicMaterial({ side: THREE.FrontSide }))
  knot.position.set(0.4, 0.2, -0.3)
  knot.rotation.set(0.3, 1.1, -0.4)
  knot.scale.set(1.3, 0.7, 1.1)
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.9, 40, 24).toNonIndexed(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
  sphere.position.set(-0.8, -0.1, 0.5)
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 1.2, 6, 3, 5), new THREE.MeshBasicMaterial({ side: THREE.BackSide }))
  box.position.set(0.2, -0.6, 0.6)
  box.rotation.y = 0.7
  const ranged = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.2, 16, 60), new THREE.MeshBasicMaterial())
  ranged.geometry.setDrawRange(300, 1500)
  ranged.position.set(0, 0.8, 0)
  const nested = new THREE.Group()
  nested.position.set(0.1, 0, 0.2)
  nested.rotation.z = 0.5
  nested.add(ranged)
  root.add(knot, sphere, box, nested)
  root.updateMatrixWorld(true)
  return root
}

const pick = (h: { distance: number; object: unknown; faceIndex?: number | null; face?: { normal: THREE.Vector3 } | null; point: THREE.Vector3 }) => ({
  distance: h.distance,
  object: h.object,
  faceIndex: h.faceIndex,
  normal: h.face ? h.face.normal.toArray() : null,
  point: h.point.toArray(),
})

describe('raycast through the triangle index', () => {
  it('finds the same hits, in the same order, as the three.js raycaster, over meshes turned, scaled, nested, one-sided, back-sided and drawn in part', () => {
    const root = scene()
    const meshes: THREE.Object3D[] = []
    root.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o))
    const ray = new THREE.Raycaster()
    const next = rng(7)
    let hits = 0
    for (let i = 0; i < 400; i++) {
      const origin = new THREE.Vector3(next() * 6 - 3, next() * 6 - 3, next() * 6 - 3)
      const towards = new THREE.Vector3(next() - 0.5, next() - 0.5, next() - 0.5)
      ray.set(origin, towards.sub(origin).normalize())
      ray.near = i % 5 === 0 ? 0.5 : 0
      ray.far = i % 3 === 0 ? 2.5 : 10
      const recursive = i % 2 === 0
      const expected = recursive ? ray.intersectObject(root, true) : ray.intersectObjects(meshes, false)
      const got = raycastIndexed(THREE, ray, recursive ? [root] : meshes, recursive)
      expect(got.map(pick)).toEqual(expected.map(pick))
      hits += got.length
    }
    expect(hits).toBeGreaterThan(200)
  })

  it('leaves a mesh with a raycast of its own to it (a decal rays pass through), and does not touch its bounds', () => {
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial())
    decal.raycast = () => undefined
    decal.updateMatrixWorld(true)
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 3), new THREE.Vector3(0, 0, -1))
    expect(raycastIndexed(THREE, ray, [decal])).toEqual([])
    expect(decal.geometry.boundingSphere).toBeNull()
  })

  it('goes through the raycast of a mesh it does not index (several materials)', () => {
    const geo = new THREE.BoxGeometry(1, 1, 1)
    const mesh = new THREE.Mesh(geo, [0, 1, 2, 3, 4, 5].map(() => new THREE.MeshBasicMaterial()))
    mesh.updateMatrixWorld(true)
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 3), new THREE.Vector3(0, 0, -1))
    expect(raycastIndexed(THREE, ray, [mesh]).map(pick)).toEqual(ray.intersectObjects([mesh]).map(pick))
  })
})
