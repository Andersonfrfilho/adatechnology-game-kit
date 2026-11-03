// Memory rule of the kit (CLAUDE.md, "Memória"): what leaves the scene frees its GPU side. three.js keeps a removed mesh's buffers, textures and
// programs until `dispose()`, so a room that only takes trees out of the scene grows on every clear. These tests fail if that comes back.
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { makeRoom } from './helpers'

type Resource = THREE.BufferGeometry | THREE.Material | THREE.Texture

/** Every geometry, material and texture under `root`, each with a flag set when it is disposed. */
function watch(root: THREE.Object3D): { resources: Resource[]; disposed: Set<Resource> } {
  const resources = new Set<Resource>()
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (mesh.geometry) resources.add(mesh.geometry)
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
    for (const material of materials) {
      resources.add(material)
      for (const value of Object.values(material)) if ((value as THREE.Texture)?.isTexture) resources.add(value as THREE.Texture)
    }
  })
  const disposed = new Set<Resource>()
  for (const resource of resources) (resource as THREE.EventDispatcher<{ dispose: object }>).addEventListener('dispose', () => disposed.add(resource))
  return { resources: [...resources], disposed }
}

/** Resources still used by something in the scene: those must stay. */
function inScene(scene: THREE.Object3D): Set<Resource> {
  const used = new Set<Resource>()
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (mesh.geometry) used.add(mesh.geometry)
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
    for (const material of materials) used.add(material)
  })
  return used
}

describe('memory: what leaves the room frees its GPU side', () => {
  it('clear() disposes the geometries and materials of the spawned items that nothing in the scene still uses', () => {
    const room = makeRoom()
    const chair = room.spawn('chair', [0, 0, -4], 0)
    const pane = room.spawn('glass_pane', [2, 0, -4], 0)
    const watched = [watch(chair.root), watch(pane.root)]
    room.clear()
    const used = inScene(room.scene)
    for (const { resources, disposed } of watched) {
      const own = resources.filter((r) => !used.has(r))
      expect(own.length).toBeGreaterThan(0)
      for (const resource of own) expect(disposed.has(resource), `${resource.type} of a cleared item`).toBe(true)
    }
  })

  it('keeps what the scene still draws: the scenery and the resources an item shares with it stay', () => {
    const room = makeRoom()
    const before = watch(room.scene)
    room.spawn('chair', [0, 0, -4], 0)
    room.clear()
    const used = inScene(room.scene)
    for (const resource of before.resources) if (used.has(resource)) expect(before.disposed.has(resource), `${resource.type} the scene still draws`).toBe(false)
  })

  it('the scene does not grow over repeated spawn and clear cycles', () => {
    const room = makeRoom()
    const count = (): number => {
      let n = 0
      room.scene.traverse(() => n++)
      return n
    }
    const cycle = (): void => {
      for (let i = 0; i < 4; i++) room.spawn(i % 2 ? 'chair' : 'glass_pane', [i, 0, -4], 0)
      for (let i = 0; i < 30; i++) room.update(1 / 30)
      room.clear()
      room.update(1 / 30)
    }
    cycle()
    const after1 = count()
    for (let i = 0; i < 3; i++) cycle()
    expect(count()).toBe(after1)
  })
})
