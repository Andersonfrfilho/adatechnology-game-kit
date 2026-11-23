import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import { FRAGMENT_INSTANCES_NAME, FragmentInstances, INSTANCED_FRAGMENT_LAYER } from '../src/fragment-instances'
import { FragmentSystem, restingBox } from '../src/fragments'
import type { FragmentSystemOptions, Live } from '../src/fragments'

const box = new THREE.BoxGeometry(1, 1, 1)
const stone = new THREE.MeshLambertMaterial({ color: 0x808080 })

const meshAt = (x: number, material: THREE.Material = stone, geometry: THREE.BufferGeometry = box): THREE.Mesh => {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x, 1 + x * 0.1, -x)
  mesh.quaternion.setFromEuler(new THREE.Euler(x * 0.3, x * 0.2, x * 0.1))
  mesh.scale.set(0.1 + x * 0.01, 0.05, 0.2)
  return mesh
}

const instancedIn = (scene: THREE.Object3D): THREE.InstancedMesh[] => scene.children.filter((child): child is THREE.InstancedMesh => (child as THREE.InstancedMesh).isInstancedMesh === true)

/** The matrix of instance `index` of `mesh`. */
const instanceMatrix = (mesh: THREE.InstancedMesh, index: number): THREE.Matrix4 => {
  const matrix = new THREE.Matrix4()
  mesh.getMatrixAt(index, matrix)
  return matrix
}

/** A mesh's matrix as the GPU gets it (float32, as the `modelMatrix` uniform of its own draw would be). */
const asDrawn = (matrix: THREE.Matrix4): THREE.Matrix4 => new THREE.Matrix4().fromArray(Float32Array.from(matrix.elements))

/** A material that looks as `source` does (what an instance draws with in place of the fragment's own, see `FragmentInstances`). */
const looksLike = (drawn: THREE.Material, source: THREE.Material): boolean =>
  drawn.type === source.type && (drawn as THREE.MeshLambertMaterial).color.getHex() === (source as THREE.MeshLambertMaterial).color.getHex()

/** The materials handed to an `InstancedMesh` and to a plain `Mesh` under `root`: a material in both makes three rebuild the program key at every draw that alternates the two. */
const materialsSharedByInstancedAndPlain = (root: THREE.Object3D): THREE.Material[] => {
  const instanced = new Set<THREE.Material>()
  const plain = new Set<THREE.Material>()
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    const into = (mesh as THREE.InstancedMesh).isInstancedMesh ? instanced : plain
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) into.add(material)
  })
  return [...instanced].filter((material) => plain.has(material))
}

/** Every drawn instance as geometry, material and matrix, and every member as the same: what the instances draw is what the meshes would have drawn. */
const expectDrawnAsMembers = (scene: THREE.Object3D, members: readonly THREE.Mesh[]): void => {
  const drawn = instancedIn(scene).flatMap((mesh) => Array.from({ length: mesh.count }, (_, index) => ({ geometry: mesh.geometry, material: mesh.material, matrix: instanceMatrix(mesh, index) })))
  expect(drawn).toHaveLength(members.length)
  for (const member of members) {
    member.updateMatrix()
    const match = drawn.findIndex((entry) => entry.geometry === member.geometry && looksLike(entry.material as THREE.Material, member.material as THREE.Material) && entry.matrix.equals(asDrawn(member.matrix)))
    expect(match).toBeGreaterThanOrEqual(0)
    drawn.splice(match, 1)
  }
}

describe('fragment instances', () => {
  it('draws the meshes of one geometry and material as one instanced mesh, each mesh moved off the cameras', () => {
    const scene = new THREE.Scene()
    const instances = new FragmentInstances(THREE, scene)
    const meshes = [0, 1, 2].map((x) => meshAt(x))
    for (const mesh of meshes) {
      scene.add(mesh)
      expect(instances.add(mesh)).toBe(true)
    }
    instances.sync()
    expect(instancedIn(scene)).toHaveLength(1)
    expect(instancedIn(scene)[0]!.name).toBe(FRAGMENT_INSTANCES_NAME)
    expect(instancedIn(scene)[0]!.castShadow).toBe(false)
    expect(instances.stats()).toEqual({ buckets: 1, drawn: 3 })
    for (const mesh of meshes) expect(mesh.layers.mask).toBe(1 << INSTANCED_FRAGMENT_LAYER)
    expectDrawnAsMembers(scene, meshes)
  })

  it('swap-removes: the last member takes the place of the one leaving, which gets its layers back', () => {
    const scene = new THREE.Scene()
    const instances = new FragmentInstances(THREE, scene)
    const meshes = [0, 1, 2, 3].map((x) => meshAt(x))
    meshes[1]!.layers.enable(3)
    const before = meshes[1]!.layers.mask
    for (const mesh of meshes) instances.add(mesh)
    instances.remove(meshes[1]!)
    instances.sync()
    expect(meshes[1]!.layers.mask).toBe(before)
    expect(instances.has(meshes[1]!)).toBe(false)
    const [instanced] = instancedIn(scene)
    expect(instanced!.count).toBe(3)
    // slot 1 now holds the last mesh
    meshes[3]!.updateMatrix()
    expect(instanceMatrix(instanced!, 1).equals(asDrawn(meshes[3]!.matrix))).toBe(true)
    expectDrawnAsMembers(scene, [meshes[0]!, meshes[2]!, meshes[3]!])
  })

  it('leaves glass and a fragment with marks to draw on their own', () => {
    const scene = new THREE.Scene()
    const instances = new FragmentInstances(THREE, scene)
    const glass = meshAt(0, new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.5 }))
    const marked = meshAt(1)
    marked.add(new THREE.Mesh(new THREE.CircleGeometry(1, 10), new THREE.MeshBasicMaterial()))
    expect(instances.add(glass)).toBe(false)
    expect(instances.add(marked)).toBe(false)
    instances.sync()
    expect(instancedIn(scene)).toHaveLength(0)
    expect(glass.layers.mask).toBe(1)
    expect(marked.layers.mask).toBe(1)
  })

  it('follows the meshes each sync, and its bounds hold every member', () => {
    const scene = new THREE.Scene()
    const instances = new FragmentInstances(THREE, scene)
    const meshes = [0, 1, 2, 3, 4].map((x) => meshAt(x))
    for (const mesh of meshes) instances.add(mesh)
    instances.sync()
    meshes[2]!.position.set(5, 3, -2)
    meshes[2]!.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 1.2)
    meshes[4]!.scale.multiplyScalar(0.3)
    instances.sync()
    expectDrawnAsMembers(scene, meshes)
    const sphere = instancedIn(scene)[0]!.boundingSphere!
    for (const mesh of meshes) {
      mesh.updateMatrixWorld()
      const own = new THREE.Box3().setFromObject(mesh)
      expect(sphere.containsPoint(own.min) && sphere.containsPoint(own.max)).toBe(true)
    }
  })

  it('grows past its first capacity and keeps every transform', () => {
    const scene = new THREE.Scene()
    const instances = new FragmentInstances(THREE, scene)
    const meshes = Array.from({ length: 40 }, (_, x) => meshAt(x))
    for (const mesh of meshes) instances.add(mesh)
    instances.sync()
    expect(instancedIn(scene)).toHaveLength(1)
    expect(instancedIn(scene)[0]!.count).toBe(40)
    expectDrawnAsMembers(scene, meshes)
  })

  it('a mask set from outside while a member is the one given back, and the mesh is hidden again; one a batch took is left to the batch', () => {
    const scene = new THREE.Scene()
    const instances = new FragmentInstances(THREE, scene)
    const [freed, taken] = [meshAt(0), meshAt(1)]
    instances.add(freed)
    instances.add(taken)
    freed.layers.mask = 1 | (1 << 4)
    taken.layers.mask = 1 << 30
    instances.sync()
    expect(freed.layers.mask).toBe(1 << INSTANCED_FRAGMENT_LAYER)
    expect(instances.has(taken)).toBe(false)
    expect(taken.layers.mask).toBe(1 << 30)
    expect(instances.add(taken)).toBe(false)
    instances.remove(freed)
    expect(freed.layers.mask).toBe(1 | (1 << 4))
  })

  it('the instanced meshes answer no ray: the meshes of the fragments do', () => {
    const scene = new THREE.Scene()
    const instances = new FragmentInstances(THREE, scene)
    const mesh = meshAt(0)
    scene.add(mesh)
    instances.add(mesh)
    instances.sync()
    scene.updateMatrixWorld(true)
    const ray = new THREE.Raycaster(new THREE.Vector3(mesh.position.x, 5, mesh.position.z), new THREE.Vector3(0, -1, 0))
    ray.layers.enableAll()
    const hits = ray.intersectObject(scene, true)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((hit) => hit.object === mesh)).toBe(true)
  })

  it('moves a mesh whose material changed to the bucket of its new material', () => {
    const scene = new THREE.Scene()
    const instances = new FragmentInstances(THREE, scene)
    const meshes = [0, 1].map((x) => meshAt(x))
    for (const mesh of meshes) instances.add(mesh)
    instances.sync()
    meshes[0]!.material = new THREE.MeshLambertMaterial({ color: 0x202020 })
    instances.sync()
    expect(instancedIn(scene)).toHaveLength(2)
    expectDrawnAsMembers(scene, meshes)
  })

  it('never hands the material of a mesh it draws by an instance to the instanced mesh: each has its own', () => {
    const scene = new THREE.Scene()
    const instances = new FragmentInstances(THREE, scene)
    const meshes = [0, 1, 2].map((x) => meshAt(x))
    for (const mesh of meshes) {
      scene.add(mesh)
      instances.add(mesh)
    }
    instances.sync()
    expect(instancedIn(scene)).toHaveLength(1)
    expect(materialsSharedByInstancedAndPlain(scene)).toEqual([])
    expect(instancedIn(scene)[0]!.material).not.toBe(stone)
    for (const mesh of meshes) instances.remove(mesh)
    instances.sync()
    for (const mesh of meshes) instances.add(mesh)
    for (let i = 3; i < 40; i++) {
      const mesh = meshAt(i)
      scene.add(mesh)
      instances.add(mesh)
    }
    instances.sync()
    expect(materialsSharedByInstancedAndPlain(scene)).toEqual([])
    expect(new Set(instancedIn(scene).map((mesh) => mesh.material)).size).toBe(1)
  })

  it('follows a fragment material marked for update, and disposes its twin with the instances', () => {
    const scene = new THREE.Scene()
    const instances = new FragmentInstances(THREE, scene)
    const source = new THREE.MeshLambertMaterial({ color: 0x808080 })
    const mesh = meshAt(0, source)
    scene.add(mesh)
    instances.add(mesh)
    instances.sync()
    const twin = instancedIn(scene)[0]!.material as THREE.MeshLambertMaterial
    expect(twin.color.getHex()).toBe(0x808080)
    source.color.set(0x204060)
    source.needsUpdate = true
    instances.sync()
    expect(twin.color.getHex()).toBe(0x204060)
    const twinDisposed = vi.fn()
    twin.addEventListener('dispose', twinDisposed)
    instances.dispose()
    expect(twinDisposed).toHaveBeenCalledTimes(1)
  })

  it('frees an emptied bucket and everything on dispose: nothing is left in the scene, every instance buffer is disposed', () => {
    const disposed = vi.spyOn(THREE.InstancedMesh.prototype, 'dispose')
    const scene = new THREE.Scene()
    const instances = new FragmentInstances(THREE, scene)
    const seen = new Set<THREE.InstancedMesh>()
    for (let round = 0; round < 3; round++) {
      const meshes = Array.from({ length: 20 }, (_, x) => meshAt(x, x % 2 === 0 ? stone : new THREE.MeshLambertMaterial({ color: x })))
      for (const mesh of meshes) instances.add(mesh)
      instances.sync()
      for (const mesh of instancedIn(scene)) seen.add(mesh)
      for (const mesh of meshes) instances.remove(mesh)
      instances.sync()
      expect(instancedIn(scene)).toHaveLength(0)
      for (const mesh of meshes) expect(mesh.layers.mask).toBe(1)
    }
    const held = meshAt(0)
    instances.add(held)
    instances.sync()
    for (const mesh of instancedIn(scene)) seen.add(mesh)
    instances.dispose()
    expect(instancedIn(scene)).toHaveLength(0)
    expect(held.layers.mask).toBe(1)
    // the grown-out first meshes are disposed too: at least one call per mesh seen
    for (const mesh of seen) expect(disposed.mock.contexts).toContain(mesh)
    disposed.mockRestore()
  })
})

describe('the fragment system draws its fragments in flight by instances', () => {
  const fragment = (index: number, extra: Record<string, unknown> = {}): never =>
    ({ id: `f${index}`, shape: 'chunk', center: [index * 0.4, 2 + index * 0.1, 0], rotation: [0, 0, 0, 1], velocity: [0.5, 2, 0], angularVelocity: [1, 2, 0.5], size: [0.1, 0.06, 0.08], material: 'brick', mass: 0.3, ...extra }) as never

  it('one instance per fragment in flight, transforms as their meshes; at rest they draw on their own again and the instances leave the scene', () => {
    const scene = new THREE.Scene()
    const system = new FragmentSystem(THREE, { scene, gravity: 9.8, groundAt: () => 0, life: 0, max: 100 } as unknown as FragmentSystemOptions)
    const brick = system.materialFor('brick', 0x9a4a3a, false)
    const glass = system.materialFor('glass', 0xaaccdd, true)
    for (let i = 0; i < 12; i++) system.spawn(fragment(i), brick, 'home', 100)
    system.spawn(fragment(20, { shape: 'shard', material: 'glass' }), glass, 'home', 100)
    system.spawn(fragment(21, { marks: [{ point: [0, 0.03, 0], normal: [0, 1, 0], diameter: 0.01 }] }), brick, 'home', 100)
    system.update(1 / 60)
    const opaque = system.meshes().filter((mesh) => mesh.children.length === 0 && !(mesh.material as THREE.Material).transparent)
    expect(opaque).toHaveLength(12)
    expect(system.instanceStats().drawn).toBe(12)
    for (const mesh of opaque) expect(mesh.layers.mask).toBe(1 << INSTANCED_FRAGMENT_LAYER)
    // glass and the marked fragment draw on their own
    expect(system.meshes().filter((mesh) => mesh.layers.mask === 1)).toHaveLength(2)
    expectDrawnAsMembers(scene, opaque)
    expect(materialsSharedByInstancedAndPlain(scene)).toEqual([])
    for (let frame = 0; frame < 30; frame++) system.update(1 / 60)
    expectDrawnAsMembers(scene, opaque)
    for (let frame = 0; frame < 600; frame++) system.update(1 / 60)
    expect(system.meshes().every((mesh) => mesh.layers.mask === 1)).toBe(true)
    expect(instancedIn(scene)).toHaveLength(0)
    expect(system.instanceStats()).toEqual({ buckets: 0, drawn: 0 })
  })

  it('clear and dispose leave no instance in the scene and give every mesh its layers back', () => {
    const scene = new THREE.Scene()
    const system = new FragmentSystem(THREE, { scene, gravity: 9.8, groundAt: () => 0, life: 0, max: 100 } as unknown as FragmentSystemOptions)
    const brick = system.materialFor('brick', 0x9a4a3a, false)
    const meshes = Array.from({ length: 8 }, (_, i) => system.spawn(fragment(i), brick, 'home', 100)!)
    system.update(1 / 60)
    expect(instancedIn(scene)).toHaveLength(1)
    system.removeHome('home')
    expect(meshes.every((mesh) => mesh.layers.mask === 1)).toBe(true)
    system.update(1 / 60)
    expect(instancedIn(scene)).toHaveLength(0)
    for (let i = 0; i < 8; i++) system.spawn(fragment(i), brick, 'home', 100)
    system.update(1 / 60)
    system.dispose()
    expect(scene.children).toHaveLength(0)
  })
})

describe('the fragments at rest look under them only where something could be lost', () => {
  it('a crater dug under one lying on the terrain: it falls into it (no wakeRegion needed)', () => {
    let floor = 0
    const scene = new THREE.Scene()
    const system = new FragmentSystem(THREE, { scene, gravity: 9.8, groundAt: () => floor, life: 0, max: 100, surfaceAt: () => floor } as unknown as FragmentSystemOptions)
    const brick = system.materialFor('brick', 0x9a4a3a, false)
    const lying = system.spawn({ id: 'c', shape: 'chunk', center: [0, 0.03, 0], rotation: [0, 0, 0, 1], velocity: [0, 0, 0], angularVelocity: [0, 0, 0], size: [0.1, 0.06, 0.08], material: 'brick', mass: 0.3 } as never, brick, 'a', 100)!
    for (let frame = 0; frame < 60; frame++) system.update(1 / 60)
    expect(lying.position.y).toBeCloseTo(0.03, 2)
    floor = -0.5
    for (let frame = 0; frame < 120; frame++) system.update(1 / 60)
    expect(lying.position.y).toBeLessThan(-0.4)
  })

  it('the box a fragment lands on, kept until it moves, is the box made afresh (fragments piling while awake)', () => {
    const scene = new THREE.Scene()
    const system = new FragmentSystem(THREE, { scene, gravity: 9.8, groundAt: () => 0, life: 0, max: 100 } as unknown as FragmentSystemOptions)
    const brick = system.materialFor('brick', 0x9a4a3a, false)
    for (let i = 0; i < 12; i++) {
      system.spawn({ id: `p${i}`, shape: 'slab', center: [0.02 * (i % 3), 0.1 + i * 0.07, 0.01 * i], rotation: [0, 0, 0, 1], velocity: [0, -0.5, 0], angularVelocity: [i * 0.2, 0.3, 0.1], size: [0.3, 0.03, 0.2], material: 'brick', mass: 2 } as never, brick, 'h', 100)
    }
    const list = (system as unknown as { list: Live[] }).list
    let compared = 0
    for (let frame = 0; frame < 240; frame++) {
      system.update(1 / 60)
      for (const f of list) {
        if (!f.box) continue
        expect(f.box).toEqual(restingBox(f))
        compared++
      }
    }
    expect(compared).toBeGreaterThan(100)
  })

  const resting = (y: number): never => ({ id: `r${y}`, shape: 'chunk', center: [0, y + 0.03, 0], rotation: [0, 0, 0, 1], velocity: [0, 0, 0], angularVelocity: [0, 0, 0], size: [0.1, 0.06, 0.08], material: 'brick', mass: 0.3 }) as never

  it('one on the ground casts no ray down; one on a slab still does, and falls when the slab goes', () => {
    let slabTop = 0.5
    const surfaceAt = vi.fn((x: number, y: number) => (y >= slabTop && Math.abs(x - 3) < 1 ? slabTop : 0))
    const scene = new THREE.Scene()
    const system = new FragmentSystem(THREE, { scene, gravity: 9.8, groundAt: () => 0, life: 0, max: 100, surfaceAt } as unknown as FragmentSystemOptions)
    const brick = system.materialFor('brick', 0x9a4a3a, false)
    const onGround = system.spawn(resting(0), brick, 'a', 100)!
    const onSlab = system.spawn({ ...(resting(0.5) as object), id: 's', center: [3, 0.53, 0] } as never, brick, 'b', 100)!
    for (let frame = 0; frame < 120; frame++) system.update(1 / 60)
    expect(onSlab.position.y).toBeGreaterThan(0.5)
    surfaceAt.mockClear()
    for (let frame = 0; frame < 30; frame++) system.update(1 / 60)
    const asked = surfaceAt.mock.calls.map(([x]) => x)
    expect(asked.some((x) => Math.abs(x - onGround.position.x) < 1e-9)).toBe(false)
    expect(asked.some((x) => Math.abs(x - onSlab.position.x) < 1e-9)).toBe(true)
    slabTop = -1
    for (let frame = 0; frame < 120; frame++) system.update(1 / 60)
    expect(onSlab.position.y).toBeLessThan(0.1)
  })
})
