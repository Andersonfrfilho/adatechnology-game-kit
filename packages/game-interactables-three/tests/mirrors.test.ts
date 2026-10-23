import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { catenary, createCord, createMirrors } from '../src'

class FakeReflector extends THREE.Mesh {
  static created = 0
  constructor(geometry: THREE.BufferGeometry, public options: any = {}) {
    super(geometry, new THREE.MeshBasicMaterial())
    FakeReflector.created++
  }
}

function setup(max = 1, withReflector = true) {
  const scene = new THREE.Scene()
  const mirrors = createMirrors(THREE, { Reflector: withReflector ? (FakeReflector as any) : undefined, max, resolution: 256 })
  const make = (id: string, x: number, ry = 0) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.6), new THREE.MeshBasicMaterial())
    mesh.position.set(x, 1, 0)
    mesh.rotation.y = ry
    scene.add(mesh)
    scene.updateMatrixWorld(true)
    mirrors.register(id, mesh)
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion)
    return { id, center: [x, 1, 0] as [number, number, number], normal: n.toArray() as [number, number, number], mesh }
  }
  const camera = new THREE.PerspectiveCamera()
  return { scene, mirrors, make, camera }
}

describe('createMirrors', () => {
  it('picks the nearest facing mirror and puts the reflector 1 mm in front with the same size and rotation', () => {
    const { scene, mirrors, make, camera } = setup(1)
    const near = make('o:near', 1, 0.3)
    const far = make('o:far', 5)
    const back = make('o:back', 0, Math.PI) // faces away from a camera at z > 0 ... (normal -z)
    camera.position.set(0, 1, 4)
    camera.updateMatrixWorld(true)
    expect(mirrors.update(camera, [back, far, near])).toEqual(['o:near'])
    const reflector = scene.children.find((c) => c instanceof FakeReflector) as FakeReflector
    expect(reflector.visible).toBe(true)
    const expected = new THREE.Vector3(...near.center).addScaledVector(new THREE.Vector3(...near.normal), 0.001)
    expect(reflector.position.distanceTo(expected)).toBeLessThan(1e-6)
    expect(reflector.quaternion.angleTo(near.mesh.quaternion)).toBeLessThan(1e-6)
    expect(reflector.scale.x).toBeCloseTo(0.8)
    expect(reflector.scale.y).toBeCloseTo(1.6)
    expect(reflector.options.textureWidth).toBe(256)
    // registered meshes show the env material
    expect(near.mesh.material).toBe(mirrors.envMaterial)
  })

  it('ignores mirrors facing away', () => {
    const { mirrors, make, camera } = setup(2)
    const back = make('o:back', 0, Math.PI)
    camera.position.set(0, 1, 4)
    expect(mirrors.update(camera, [back])).toEqual([])
  })

  it('reuses the pooled reflector when the nearest mirror changes', () => {
    FakeReflector.created = 0
    const { scene, mirrors, make, camera } = setup(1)
    const a = make('o:a', -3)
    const b = make('o:b', 3)
    camera.position.set(-3, 1, 3)
    expect(mirrors.update(camera, [a, b])).toEqual(['o:a'])
    camera.position.set(3, 1, 3)
    expect(mirrors.update(camera, [a, b])).toEqual(['o:b'])
    expect(FakeReflector.created).toBe(1)
    expect(scene.children.filter((c) => c instanceof FakeReflector).length).toBe(1)
    expect(mirrors.update(camera, [])).toEqual([])
    expect(mirrors.active()).toEqual([])
  })

  it('honours max > 1', () => {
    const { mirrors, make, camera } = setup(2)
    const list = [make('a', -2), make('b', 0), make('c', 0.5)]
    camera.position.set(0, 1, 5)
    expect(mirrors.update(camera, list).sort()).toEqual(['b', 'c'])
    expect(mirrors.active().length).toBe(2)
  })

  it('works without a Reflector (env only)', () => {
    const { mirrors, make, camera } = setup(1, false)
    const m = make('o:m', 0)
    camera.position.set(0, 1, 3)
    expect(mirrors.update(camera, [m])).toEqual([])
    expect(m.mesh.material).toBe(mirrors.envMaterial)
    mirrors.unregister('o:m')
    expect(m.mesh.material).not.toBe(mirrors.envMaterial)
  })
})

describe('cords', () => {
  it('catenary hangs sag meters below the chord, ends fixed', () => {
    const pts = catenary([0, 2, 0], [4, 2, 0], 0.5, 21)
    expect(pts.length).toBe(21)
    expect(pts[0]).toEqual([0, 2, 0])
    expect(pts[20]).toEqual([4, 2, 0])
    expect(pts[10][1]).toBeCloseTo(1.5, 3)
    expect(Math.min(...pts.map((p) => p[1]))).toBeCloseTo(1.5, 3)
    expect(catenary([0, 0, 0], [1, 0, 0], 0, 3)[1][1]).toBe(0)
  })

  it('createCord builds a tube mesh', () => {
    const mat = new THREE.MeshBasicMaterial()
    const mesh = createCord(THREE, catenary([0, 2, 0], [3, 1, 1], 0.3, 8), 0.01, mat)
    expect(mesh.geometry).toBeInstanceOf(THREE.TubeGeometry)
    expect(mesh.material).toBe(mat)
    expect(() => createCord(THREE, [[0, 0, 0]], 0.01, mat)).toThrow()
  })
})
