import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import { MeshRayProbe } from '../src/mesh-ray-probe'
import { Visuals } from '../src/visual'

const SLABS = 40
const HOLES = 120
const FACE = new THREE.Vector3(0, 0, 1)

/** A row of slabs merged in one indexed mesh, under a scaled and rotated parent. */
const row = () => {
  const geometries = Array.from({ length: SLABS }, (_, i) => new THREE.BoxGeometry(1, 2, 0.2, 6, 10, 1).translate(i * 1.2, 1, 0))
  const position: number[] = []
  const index: number[] = []
  for (const g of geometries) {
    const base = position.length / 3
    position.push(...(g.getAttribute('position').array as Float32Array))
    for (const k of g.getIndex()!.array as Uint16Array) index.push(base + k)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial())
  const parent = new THREE.Group()
  parent.scale.set(1.5, 0.8, 1.1)
  parent.rotation.set(0.1, 0.4, -0.05)
  parent.position.set(3, -1, 2)
  parent.add(mesh)
  parent.updateMatrixWorld(true)
  return { mesh, triangles: index.length / 3 }
}

const seeded = (seed: number): (() => number) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return seed / 2 ** 32
}

const shortRays = (mesh: THREE.Mesh, count: number): THREE.Raycaster[] => {
  const random = seeded(7)
  return Array.from({ length: count }, () => {
    const target = mesh.localToWorld(new THREE.Vector3(random() * SLABS * 1.2, random() * 2, 0.1))
    const direction = new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 1.2).normalize()
    const raycaster = new THREE.Raycaster(target.clone().addScaledVector(direction, -0.03), direction, 0, 0.06)
    return raycaster
  })
}

const summary = (hits: THREE.Intersection[]): unknown[] => hits.map((hit) => ({ distance: hit.distance, point: hit.point.toArray(), faceIndex: hit.faceIndex, face: hit.face && { a: hit.face.a, b: hit.face.b, c: hit.face.c, normal: hit.face.normal.toArray() }, object: hit.object.uuid }))

describe('the probe gives the hits of mesh.raycast without visiting every triangle', () => {
  it('equals mesh.raycast on a lot of short rays, before and after the mesh is written', () => {
    const { mesh } = row()
    const probe = new MeshRayProbe(THREE)
    const rays = shortRays(mesh, 300)
    const compare = (): number => {
      let withHits = 0
      for (const raycaster of rays) {
        const expected: THREE.Intersection[] = []
        mesh.raycast(raycaster, expected)
        const actual: THREE.Intersection[] = []
        probe.raycast(mesh, raycaster, actual)
        expect(summary(actual)).toEqual(summary(expected))
        if (expected.length > 0) withHits++
      }
      return withHits
    }
    expect(compare()).toBeGreaterThan(30)
    const position = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < position.count; i += 7) position.setZ(i, position.getZ(i) + 0.01)
    position.needsUpdate = true
    mesh.geometry.boundingSphere = null
    expect(compare()).toBeGreaterThan(30)
  })

  it('hands mesh.raycast a few triangles, not the mesh', () => {
    const { mesh, triangles } = row()
    const probe = new MeshRayProbe(THREE)
    const rays = shortRays(mesh, HOLES)
    const spy = vi.spyOn(THREE.Ray.prototype, 'intersectTriangle')
    for (const raycaster of rays) probe.raycast(mesh, raycaster, [])
    const tested = spy.mock.calls.length
    spy.mockRestore()
    const plain = vi.spyOn(THREE.Ray.prototype, 'intersectTriangle')
    for (const raycaster of rays) mesh.raycast(raycaster, [])
    const whole = plain.mock.calls.length
    plain.mockRestore()
    expect(whole).toBeGreaterThan(HOLES * triangles * 0.5)
    expect(tested).toBeLessThan(HOLES * 40)
  })

  it('a mesh with several materials goes to mesh.raycast itself', () => {
    const { mesh } = row()
    mesh.geometry.addGroup(0, 30, 0)
    mesh.material = [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()] as unknown as THREE.MeshBasicMaterial
    const probe = new MeshRayProbe(THREE)
    const spy = vi.spyOn(mesh, 'raycast')
    probe.raycast(mesh, shortRays(mesh, 1)[0]!, [])
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('addHole on a big merged mesh visits a few triangles per mark', () => {
    const { mesh } = row()
    const visuals = new Visuals(THREE, false, 1000)
    const mv = visuals.makeMeshVis(mesh, 'row')
    const spots = shortRays(mesh, HOLES).map((raycaster) => raycaster.ray.at(0.03, new THREE.Vector3()))
    const spy = vi.spyOn(THREE.Ray.prototype, 'intersectTriangle')
    for (const spot of spots) visuals.addHole(mv, spot, FACE.clone(), 0.05)
    const tested = spy.mock.calls.length
    spy.mockRestore()
    expect(tested).toBeLessThan(HOLES * 40)
    expect(mv.decals.length).toBe(Math.min(48, HOLES))
  })
})
