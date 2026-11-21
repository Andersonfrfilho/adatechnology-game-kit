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

  it.each([
    ['a normalized position attribute', (mesh: THREE.Mesh): void => { mesh.geometry.setAttribute('position', new THREE.Int16BufferAttribute(Int16Array.from([0, 0, 0, 20000, 0, 0, 0, 20000, 0]), 3, true)) }],
    ['a position array that is not a Float32Array', (mesh: THREE.Mesh): void => { mesh.geometry.setAttribute('position', new THREE.Float64BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3)) }],
  ])('%s goes to the plain raycast', (_name, rewrite) => {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
    rewrite(mesh)
    mesh.updateMatrixWorld(true)
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0.2, 0.2, 0.5), new THREE.Vector3(0, 0, -1), 0, 0.6)
    const expected: THREE.Intersection[] = []
    mesh.raycast(raycaster, expected)
    const probe = new MeshRayProbe(THREE)
    const actual: THREE.Intersection[] = []
    probe.raycast(mesh, raycaster, actual)
    expect(expected.length).toBe(1)
    expect(summary(actual)).toEqual(summary(expected))
    expect(probe.boxBuildCount).toBe(0)
  })

  it('keeps no reference to the geometry or material of the mesh it probed', () => {
    const { mesh } = row()
    const probe = new MeshRayProbe(THREE)
    for (const raycaster of shortRays(mesh, 30)) probe.raycast(mesh, raycaster, [])
    const stand = (probe as unknown as { stand: THREE.Mesh }).stand
    expect(stand.material).not.toBe(mesh.material)
    expect(stand.geometry).not.toBe(mesh.geometry)
    for (const name of ['position', 'normal', 'uv', 'uv1']) expect(stand.geometry.getAttribute(name)).toBeUndefined()
    expect(stand.geometry.boundingSphere).toBeNull()
    expect(stand.geometry.boundingBox).toBeNull()
  })

  it('the boxes follow the position attribute version: stale without needsUpdate, rebuilt with it', () => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3))
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial())
    mesh.updateMatrixWorld(true)
    const probe = new MeshRayProbe(THREE)
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0.2, 0.2, 5.5), new THREE.Vector3(0, 0, -1), 0, 0.6)
    probe.raycast(mesh, new THREE.Raycaster(new THREE.Vector3(0.2, 0.2, 0.5), new THREE.Vector3(0, 0, -1), 0, 0.6), [])
    const position = geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < position.count; i++) position.setZ(i, 5)
    geometry.boundingSphere = null
    const stale: THREE.Intersection[] = []
    probe.raycast(mesh, raycaster, stale)
    const plain: THREE.Intersection[] = []
    mesh.raycast(raycaster, plain)
    expect(plain.length).toBe(1)
    expect(stale.length).toBe(0)
    position.needsUpdate = true
    const fresh: THREE.Intersection[] = []
    probe.raycast(mesh, raycaster, fresh)
    expect(summary(fresh)).toEqual(summary(plain))
    expect(fresh[0]!.point.z).toBeCloseTo(5, 6)
  })

  it('probes against the same unchanged geometry build the boxes once', () => {
    const { mesh } = row()
    const probe = new MeshRayProbe(THREE)
    for (const raycaster of shortRays(mesh, 50)) probe.raycast(mesh, raycaster, [])
    expect(probe.boxBuildCount).toBe(1)
    const position = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    position.needsUpdate = true
    for (const raycaster of shortRays(mesh, 5)) probe.raycast(mesh, raycaster, [])
    expect(probe.boxBuildCount).toBe(2)
  })

  describe('Visuals.onFace against a plain mesh.raycast', () => {
    type OnFace = (mesh: THREE.Mesh, point: THREE.Vector3, normal: THREE.Vector3) => THREE.Vector3
    type Probed = { onFace: OnFace; meshRays: { raycast: (mesh: THREE.Mesh, raycaster: THREE.Raycaster, hits: THREE.Intersection[]) => void } }

    const chained = (geometry: THREE.BufferGeometry): THREE.Mesh => {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
      const outer = new THREE.Group()
      outer.scale.set(1.3, 0.9, 1.1)
      outer.rotation.set(0.2, -0.5, 0.1)
      outer.position.set(2, 1, -3)
      const inner = new THREE.Group()
      inner.rotation.set(-0.3, 0.2, 0.4)
      inner.position.set(0.5, -0.2, 0.7)
      outer.add(inner)
      inner.add(mesh)
      outer.updateMatrixWorld(true)
      return mesh
    }

    const meshes = (): [string, THREE.Mesh][] => [
      ['indexed row', row().mesh],
      ['non-indexed box', chained(new THREE.BoxGeometry(2, 2, 2, 4, 4, 4).toNonIndexed())],
      ['indexed sphere', chained(new THREE.SphereGeometry(1.5, 24, 16))],
    ]

    it.each(meshes())('%s: same point, face and normal within 1e-6', (_name, mesh) => {
      const visuals = new Visuals(THREE, false, 1000) as unknown as Probed
      const reference = new Visuals(THREE, false, 1000) as unknown as Probed
      reference.meshRays = { raycast: (target, raycaster, hits) => target.raycast(raycaster, hits) }
      const probe = new MeshRayProbe(THREE)
      const random = seeded(11)
      let withHits = 0
      for (let i = 0; i < 300; i++) {
        const positions = mesh.geometry.getAttribute('position')
        const vertex = Math.floor(random() * positions.count)
        const target = mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(positions, vertex).add(new THREE.Vector3(random() * 0.1, random() * 0.1, random() * 0.1)))
        const direction = new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize()
        const raycaster = new THREE.Raycaster(target.clone().addScaledVector(direction, -0.03), direction, 0, 0.06)
        const expected: THREE.Intersection[] = []
        mesh.raycast(raycaster, expected)
        const actual: THREE.Intersection[] = []
        probe.raycast(mesh, raycaster, actual)
        expect(actual.length).toBe(expected.length)
        actual.forEach((hit, k) => {
          const other = expected[k]!
          expect(hit.faceIndex).toBe(other.faceIndex)
          expect(hit.point.distanceTo(other.point)).toBeLessThan(1e-6)
          expect(hit.face!.normal.distanceTo(other.face!.normal)).toBeLessThan(1e-6)
        })
        const normal = direction.clone().negate()
        const point = target.clone()
        expect(visuals.onFace(mesh, point, normal).distanceTo(reference.onFace(mesh, point, normal))).toBeLessThan(1e-6)
        if (expected.length > 0) withHits++
      }
      expect(withHits).toBeGreaterThan(10)
    })
  })
})
