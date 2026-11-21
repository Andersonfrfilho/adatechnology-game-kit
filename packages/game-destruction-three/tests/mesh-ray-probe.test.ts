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

const summary = (hits: THREE.Intersection[]): unknown[] => hits.map((hit) => ({ distance: hit.distance, point: hit.point.toArray(), faceIndex: hit.faceIndex, face: hit.face && { a: hit.face.a, b: hit.face.b, c: hit.face.c, materialIndex: hit.face.materialIndex, normal: hit.face.normal.toArray() }, instanceId: hit.instanceId, object: hit.object.uuid }))

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

  describe('a mesh the stand-in cannot copy goes to mesh.raycast: same hits, no boxes built', () => {
    const throughCenter = (): THREE.Raycaster => new THREE.Raycaster(new THREE.Vector3(0.1, 0.2, 3), new THREE.Vector3(0, 0, -1), 0, 6)

    const expectFallback = (mesh: THREE.Mesh, raycaster: THREE.Raycaster): THREE.Intersection[] => {
      mesh.updateMatrixWorld(true)
      const expected: THREE.Intersection[] = []
      mesh.raycast(raycaster, expected)
      const probe = new MeshRayProbe(THREE)
      const actual: THREE.Intersection[] = []
      probe.raycast(mesh, raycaster, actual)
      expect(expected.length).toBeGreaterThan(0)
      // Equal hits are a sanity check (both sides ran mesh.raycast); boxBuildCount === 0 is the assertion that can fail.
      expect(summary(actual)).toEqual(summary(expected))
      expect(probe.boxBuildCount).toBe(0)
      return actual
    }

    const doubleSided = (): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })

    it('several materials on a grouped geometry (face.materialIndex kept)', () => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), Array.from({ length: 6 }, doubleSided))
      const hits = expectFallback(mesh, throughCenter())
      expect(new Set(hits.map((hit) => hit.face!.materialIndex)).size).toBe(2)
    })

    it('a skinned mesh', () => {
      const geometry = new THREE.BoxGeometry(2, 2, 2)
      const count = geometry.getAttribute('position').count
      geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4))
      geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Array.from({ length: count * 4 }, (_, i) => (i % 4 === 0 ? 1 : 0)), 4))
      const mesh = new THREE.SkinnedMesh(geometry, doubleSided())
      const bone = new THREE.Bone()
      mesh.add(bone)
      mesh.bind(new THREE.Skeleton([bone]))
      expectFallback(mesh, throughCenter())
    })

    it('morph targets', () => {
      const geometry = new THREE.BoxGeometry(2, 2, 2)
      const shifted = Float32Array.from(geometry.getAttribute('position').array, (value, i) => (i % 3 === 2 ? value + 0.5 : value))
      geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(shifted, 3)]
      const mesh = new THREE.Mesh(geometry, doubleSided())
      mesh.morphTargetInfluences![0] = 0.8
      expectFallback(mesh, throughCenter())
    })

    it('an interleaved position attribute', () => {
      const geometry = new THREE.BoxGeometry(2, 2, 2)
      const interleaved = new THREE.InterleavedBuffer(Float32Array.from(geometry.getAttribute('position').array), 3)
      geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(interleaved, 3, 0))
      expectFallback(new THREE.Mesh(geometry, doubleSided()), throughCenter())
    })

    it('an InstancedMesh', () => {
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 2, 2), doubleSided(), 2)
      mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 0, 0))
      mesh.setMatrixAt(1, new THREE.Matrix4().makeTranslation(0, 0, -2))
      const hits = expectFallback(mesh, throughCenter())
      expect(new Set(hits.map((hit) => hit.instanceId)).size).toBe(2)
    })

    it('a non-finite raycaster.far', () => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), doubleSided())
      const raycaster = throughCenter()
      raycaster.far = Infinity
      expectFallback(mesh, raycaster)
    })

    it('a mesh with its own raycast', () => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), doubleSided())
      mesh.raycast = function (this: THREE.Mesh, raycaster, hits) {
        THREE.Mesh.prototype.raycast.call(this, raycaster, hits)
        hits.length = Math.min(hits.length, 1)
      }
      expect(expectFallback(mesh, throughCenter())).toHaveLength(1)
    })
  })

  describe('draw range and ray limits give the hits of mesh.raycast', () => {
    const FIRST = 100
    const COUNT = 50

    /** A ray along the inward normal of triangle `t`, starting 0.03 in front of its centroid. */
    const aimedAt = (mesh: THREE.Mesh, t: number): THREE.Raycaster => {
      const position = mesh.geometry.getAttribute('position')
      const index = mesh.geometry.index
      const corner = (k: number): THREE.Vector3 => new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(t * 3 + k) : t * 3 + k)
      const triangle = new THREE.Triangle(corner(0), corner(1), corner(2))
      const normal = triangle.getNormal(new THREE.Vector3())
      const origin = mesh.localToWorld(triangle.getMidpoint(new THREE.Vector3()).addScaledVector(normal, 0.03))
      return new THREE.Raycaster(origin, normal.negate().transformDirection(mesh.matrixWorld), 0, 0.06)
    }

    const doubleSided = (mesh: THREE.Mesh): THREE.Mesh => {
      mesh.material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
      return mesh
    }

    const expectSameHits = (mesh: THREE.Mesh, raycasters: THREE.Raycaster[]): number[] => {
      const probe = new MeshRayProbe(THREE)
      return raycasters.map((raycaster) => {
        const expected: THREE.Intersection[] = []
        mesh.raycast(raycaster, expected)
        const actual: THREE.Intersection[] = []
        probe.raycast(mesh, raycaster, actual)
        expect(summary(actual)).toEqual(summary(expected))
        return expected.length
      })
    }

    it.each([
      ['an indexed mesh', (): THREE.Mesh => doubleSided(row().mesh)],
      ['a non-indexed mesh', (): THREE.Mesh => doubleSided(new THREE.Mesh(row().mesh.geometry.toNonIndexed()))],
    ])('setDrawRange on %s: triangles inside and outside the range', (_name, build) => {
      const mesh = build()
      const parent = new THREE.Group()
      parent.scale.set(1.5, 0.8, 1.1)
      parent.add(mesh)
      parent.updateMatrixWorld(true)
      mesh.geometry.setDrawRange(FIRST * 3, COUNT * 3)
      const inside = Array.from({ length: COUNT }, (_, i) => FIRST + i)
      const outside = [0, 7, FIRST - 3, FIRST - 1, FIRST + COUNT, FIRST + COUNT + 1, FIRST + COUNT + 40, 600]
      const insideHits = expectSameHits(mesh, inside.map((t) => aimedAt(mesh, t)))
      const outsideHits = expectSameHits(mesh, outside.map((t) => aimedAt(mesh, t)))
      expect(insideHits.every((hits) => hits > 0)).toBe(true)
      expect(outsideHits.every((hits) => hits === 0)).toBe(true)
    })

    it('a parent with negative scale', () => {
      const { mesh } = row()
      mesh.parent!.scale.set(-1.5, 0.8, 1.1)
      mesh.parent!.updateMatrixWorld(true)
      const hits = expectSameHits(mesh, shortRays(mesh, 200))
      expect(hits.filter((count) => count > 0).length).toBeGreaterThan(10)
    })

    it('raycaster.near above zero', () => {
      const { mesh } = row()
      doubleSided(mesh)
      const rays = shortRays(mesh, 200)
      for (const raycaster of rays) {
        raycaster.ray.origin.addScaledVector(raycaster.ray.direction, -0.1)
        raycaster.far = 0.5
      }
      const hitsAt = (near: number): number => {
        for (const raycaster of rays) raycaster.near = near
        return expectSameHits(mesh, rays).reduce((sum, count) => sum + count, 0)
      }
      const all = hitsAt(0)
      const backFacesOnly = hitsAt(0.2)
      expect(backFacesOnly).toBeGreaterThan(0)
      expect(backFacesOnly).toBeLessThan(all)
      expect(hitsAt(1)).toBe(0)
    })
  })

  describe('the candidate buffers grow without losing or corrupting hits', () => {
    const SPACING = 0.01

    /** Parallel double-sided quads stacked along z (2 triangles each): a ray down -z has both triangles of every quad in its segment box, and hits one per quad. */
    const stack = (quads: number): THREE.Mesh => {
      const position: number[] = []
      const index: number[] = []
      for (let i = 0; i < quads; i++) {
        const base = i * 4
        const z = -i * SPACING
        position.push(-1, -1, z, 1, -1, z, 1, 1, z, -1, 1, z)
        index.push(base, base + 1, base + 2, base, base + 2, base + 3)
      }
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
      geometry.setIndex(index)
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
      mesh.updateMatrixWorld(true)
      return mesh
    }

    /** A ray down -z whose segment box covers the first `quads` quads of the stack. */
    const downThrough = (quads: number): THREE.Raycaster => new THREE.Raycaster(new THREE.Vector3(0.1, 0.2, 0.5), new THREE.Vector3(0, 0, -1), 0, 0.5 + (quads - 0.5) * SPACING)

    /** Probes the ray on `probe`, checks the hits against mesh.raycast, and returns how many candidate triangles the stand-in tested. */
    const probeAndCompare = (probe: MeshRayProbe, mesh: THREE.Mesh, raycaster: THREE.Raycaster): number => {
      const expected: THREE.Intersection[] = []
      mesh.raycast(raycaster, expected)
      const spy = vi.spyOn(THREE.Ray.prototype, 'intersectTriangle')
      const actual: THREE.Intersection[] = []
      probe.raycast(mesh, raycaster, actual)
      const candidates = spy.mock.calls.length
      spy.mockRestore()
      expect(actual.length).toBeGreaterThan(0)
      expect(actual.map((hit) => hit.faceIndex)).toEqual(expected.map((hit) => hit.faceIndex))
      expect(summary(actual)).toEqual(summary(expected))
      return candidates
    }

    it.each([
      ['the first growth', 12, 21],
      ['a second doubling', 25, 42],
      ['a third doubling', 50, 85],
      ['one large jump on a fresh probe', 200, 300],
    ])('%s', (_name, quads, threshold) => {
      const mesh = stack(quads)
      const candidates = probeAndCompare(new MeshRayProbe(THREE), mesh, downThrough(quads))
      expect(candidates).toBeGreaterThan(threshold)
    })

    it('a small ray, then a large one, then a small one again on the same probe', () => {
      const mesh = stack(200)
      const probe = new MeshRayProbe(THREE)
      const small = probeAndCompare(probe, mesh, downThrough(5))
      const large = probeAndCompare(probe, mesh, downThrough(200))
      const smallAgain = probeAndCompare(probe, mesh, downThrough(5))
      expect(small).toBeLessThan(21)
      expect(large).toBeGreaterThan(300)
      expect(smallAgain).toBe(small)
    })
  })

  it('releases the stand-in even when its raycast throws', () => {
    const { mesh } = row()
    const probe = new MeshRayProbe(THREE)
    const stand = (probe as unknown as { stand: THREE.Mesh }).stand
    const spy = vi.spyOn(stand, 'raycast').mockImplementation(() => {
      throw new Error('stand-in raycast failed')
    })
    const raycaster = shortRays(mesh, 50).find((candidate) => {
      const hits: THREE.Intersection[] = []
      mesh.raycast(candidate, hits)
      return hits.length > 0
    })!
    expect(() => probe.raycast(mesh, raycaster, [])).toThrow('stand-in raycast failed')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(stand.material).not.toBe(mesh.material)
    expect(stand.geometry.getAttribute('position')).toBeUndefined()
    expect(stand.geometry.boundingSphere).toBeNull()
    expect(stand.geometry.boundingBox).toBeNull()
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

  // Pins the needsUpdate contract documented in visual.ts, not a robustness goal.
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

  it('a ray that meets no triangle still leaves the bounding sphere computed, as mesh.raycast does', () => {
    const missRay = () => new THREE.Raycaster(new THREE.Vector3(500, 500, 0.1), new THREE.Vector3(0, 0, -1), 0, 0.06)
    const plainMesh = row().mesh
    plainMesh.raycast(missRay(), [])
    const probedMesh = row().mesh
    new MeshRayProbe(THREE).raycast(probedMesh, missRay(), [])
    expect(plainMesh.geometry.boundingSphere).not.toBeNull()
    expect(probedMesh.geometry.boundingSphere).not.toBeNull()
    expect(probedMesh.geometry.boundingSphere!.radius).toBe(plainMesh.geometry.boundingSphere!.radius)
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
