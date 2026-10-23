import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { applyPose, createMeshApi, poseOf } from '../src'

const M = {}

function draw(api: ReturnType<typeof createMeshApi>['api']) {
  api.box(M, 'wood', 0, 0, 0, 1, 1, 1, 0xaa8844, 0, 0, 0)
  api.box(M, 'wood', 2, 0, 0, 1, 1, 1, 0xaa8844, 0.3, 0, 0)
  api.box(M, 'wood', 4, 0, 0, 1, 1, 1, 0xaa8844, 0, 0, 0)
  api.cylinder(M, 'metal', 0, 1, 0, 0.1, 0.3, 0x999999, 0, 0)
  api.cylinder(M, 'metal', 1, 1, 0, 0.1, 0.3, 0x999999, 0, 0, 'cone')
  api.cylinder(M, 'plain', 1, 1, 1, 0.1, 0.3, 0xffffff, 0, 0, 'sphere')
  api.cylinder(M, 'plain', 1, 1, 1, 0.1, 0.3, 0xffffff, 0, 0, 'cyl6')
  api.leaf(M, 0, 0, 0, 0.3, 0.5, 0x33aa33, 0, 0)
  api.plane(M, 'glass', 0, 1, 0, 1, 1, 0xffffff, 0, 0, 0)
}

describe('createMeshApi', () => {
  it('merges primitives into one mesh per material', () => {
    const { api, finish } = createMeshApi(THREE)
    draw(api)
    const { group, parts } = finish()
    const meshes = group.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh)
    // wood, metal, plain, plant (leaf), glass
    expect(meshes.map((m) => m.userData.material).sort()).toEqual(['glass', 'metal', 'plain', 'plant', 'wood'])
    expect(meshes.length).toBe(5)
    expect(Object.keys(parts)).toEqual([])
    const wood = meshes.find((m) => m.userData.material === 'wood')!
    // 3 boxes of 24 vertices
    expect(wood.geometry.getAttribute('position').count).toBe(72)
    expect(wood.geometry.getAttribute('color')).toBeTruthy()
    expect(wood.geometry.getAttribute('uv')).toBeTruthy()
    expect(wood.geometry.index!.count).toBe(3 * 36)
  })

  it('bakes vertex colors, positions and the box base at y', () => {
    const { api, finish } = createMeshApi(THREE)
    api.box(M, 'plain', 1, 0.5, 2, 2, 1, 4, 0xff0000, 0, 0, 0)
    const mesh = finish().group.children[0] as THREE.Mesh
    mesh.geometry.computeBoundingBox()
    const bb = mesh.geometry.boundingBox!
    expect(bb.min.toArray()).toEqual([0, 0.5, 0])
    expect(bb.max.toArray()).toEqual([2, 1.5, 4])
    const c = mesh.geometry.getAttribute('color')
    expect(c.getX(0)).toBeCloseTo(1)
    expect(c.getY(0)).toBeCloseTo(0)
  })

  it('applies the item transform M.x / M.z / M.ry', () => {
    const { api, finish } = createMeshApi(THREE)
    api.box({ x: 10, z: -3, ry: Math.PI / 2 }, 'plain', 1, 0, 0, 1, 1, 1, 0xffffff, 0, 0, 0)
    const mesh = finish().group.children[0] as THREE.Mesh
    mesh.geometry.computeBoundingBox()
    const centre = mesh.geometry.boundingBox!.getCenter(new THREE.Vector3())
    // local (1, ., 0) turned +90deg about y -> (0, ., -1), then moved by (10, -3)
    expect(centre.x).toBeCloseTo(10)
    expect(centre.z).toBeCloseTo(-4)
  })

  it('keeps parts as separate groups with the origin at the pivot', () => {
    const { api, finish } = createMeshApi(THREE)
    api.box(M, 'plain', 0, 0, 0, 2, 1, 1, 0xffffff, 0, 0, 0)
    api.part('door', [1, 0, 0.5], Math.PI / 2, () => {
      api.box(M, 'wood', 1, 0, 0.5, 0.1, 2, 1, 0x884422, 0, 0, 0)
      api.box(M, 'metal', 1, 1, 0.5, 0.1, 0.1, 0.1, 0xcccccc, 0, 0, 0)
    })
    api.part('drawer', [0, 0, 0], 0, () => {
      api.box(M, 'wood', 0, 0, 0, 1, 1, 1, 0x884422, 0, 0, 0)
    })
    const { group, parts } = finish()
    expect(Object.keys(parts).sort()).toEqual(['door', 'drawer'])
    const door = parts.door
    expect(door.parent).toBe(group)
    expect(door.name).toBe('part:door')
    expect(door.userData.part).toBe('door')
    expect(door.position.toArray()).toEqual([1, 0, 0.5])
    expect(door.rotation.y).toBeCloseTo(Math.PI / 2)
    expect(door.children.length).toBe(2)
    for (const m of door.children as THREE.Mesh[]) {
      expect(m.userData.part).toBe('door')
      expect(m.name).toBe('part:door')
    }
    // the static mesh does not contain the door geometry
    const staticMesh = group.children.find((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh
    expect(staticMesh.geometry.getAttribute('position').count).toBe(24)
    // world position of the door box centre is unchanged by the pivot move: (1, 1, 0.5)
    group.updateMatrixWorld(true)
    const wood = door.children.find((c) => c.userData.material === 'wood') as THREE.Mesh
    wood.geometry.computeBoundingBox()
    const c = wood.geometry.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(wood.matrixWorld)
    expect(c.x).toBeCloseTo(1)
    expect(c.y).toBeCloseTo(1)
    expect(c.z).toBeCloseTo(0.5)
    // the box sits right above the pivot, so its centre is (0, 1, 0) in the part's own frame
    const local = wood.geometry.boundingBox!.getCenter(new THREE.Vector3())
    expect(local.toArray().map((n) => Math.round(n * 1000) / 1000)).toEqual([0, 1, 0])
  })

  it('traces a raycast hit back to the part', () => {
    const { api, finish } = createMeshApi(THREE)
    api.part('lid', [0, 1, 0], 0, () => api.box(M, 'plain', 0, 1, 0, 1, 0.1, 1, 0xffffff, 0, 0, 0))
    const { group } = finish()
    group.updateMatrixWorld(true)
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, -1, 0))
    const hit = ray.intersectObject(group, true)[0]
    expect(hit.object.userData.part).toBe('lid')
  })

  it('uses the given materials and falls back to defaults', () => {
    const wood = new THREE.MeshBasicMaterial({ color: 0x123456 })
    const { api, finish } = createMeshApi(THREE, { materials: { wood }, quality: 'game' })
    api.box(M, 'wood', 0, 0, 0, 1, 1, 1, 0xffffff, 0, 0, 0)
    api.box(M, 'plain', 0, 0, 0, 1, 1, 1, 0xffffff, 0, 0, 0)
    const meshes = finish().group.children as THREE.Mesh[]
    expect(meshes.find((m) => m.userData.material === 'wood')!.material).toBe(wood)
    expect((meshes.find((m) => m.userData.material === 'plain')!.material as THREE.Material).type).toBe('MeshLambertMaterial')
  })

  it('creates real lights for api.light', () => {
    const { api, finish } = createMeshApi(THREE)
    api.light!(M, 1, 2, 3, 0xffeeaa, 6, 'pendant')
    const { group, lights } = finish()
    expect(lights.length).toBe(1)
    expect(lights[0].parent).toBe(group)
    expect(lights[0].position.toArray()).toEqual([1, 2, 3])
  })

  it('is deterministic', () => {
    const run = () => {
      const { api, finish } = createMeshApi(THREE)
      draw(api)
      return Array.from((finish().group.children[0] as THREE.Mesh).geometry.getAttribute('position').array)
    }
    expect(run()).toEqual(run())
  })
})

describe('applyPose', () => {
  const part = () => {
    const { api, finish } = createMeshApi(THREE)
    api.part('p', [1, 0, 2], Math.PI / 2, () => api.box(M, 'plain', 1, 0, 2, 1, 1, 1, 0xffffff, 0, 0, 0))
    return finish().parts.p
  }

  it('hinge rotates around the axis through the pivot and remembers the rest pose', () => {
    const g = part()
    applyPose(THREE, g, { kind: 'hinge', axis: [0, 1, 0], angle: Math.PI / 2 }, 1)
    expect(g.position.toArray()).toEqual([1, 0, 2])
    const yaw = () => new THREE.Vector3(0, 0, 1).applyQuaternion(g.quaternion) // +z turned about y
    expect(yaw().x).toBeCloseTo(Math.sin(Math.PI), 5)
    expect(yaw().z).toBeCloseTo(Math.cos(Math.PI), 5)
    expect(g.userData.rest.quaternion[3]).toBeCloseTo(Math.cos(Math.PI / 4))
    applyPose(THREE, g, { kind: 'hinge', angle: Math.PI / 2 }, 0.5)
    expect(yaw().x).toBeCloseTo(Math.sin(Math.PI / 2 + Math.PI / 4), 5)
    applyPose(THREE, g, { kind: 'hinge', angle: Math.PI / 2 }, 0)
    expect(yaw().x).toBeCloseTo(1, 5)
  })

  it('slide moves along the axis in the part frame', () => {
    const g = part() // part frame turned 90deg about y: local +x -> world -z
    applyPose(THREE, g, { kind: 'slide', axis: [1, 0, 0], distance: 0.5 }, 1)
    expect(g.position.x).toBeCloseTo(1)
    expect(g.position.z).toBeCloseTo(2 - 0.5)
    applyPose(THREE, g, { kind: 'slide', axis: [1, 0, 0], distance: 0.5 }, 0)
    expect(g.position.toArray()).toEqual([1, 0, 2])
  })

  it('scale scales along the axis only', () => {
    const g = part()
    applyPose(THREE, g, { kind: 'scale', axis: [0, 1, 0], scale: 0.2 }, 1)
    expect(g.scale.toArray()).toEqual([1, 0.2, 1].map((n) => expect.closeTo(n, 5)))
    applyPose(THREE, g, { kind: 'scale', axis: [0, 1, 0], scale: 0.2 }, 0.5)
    expect(g.scale.y).toBeCloseTo(0.6)
  })

  it('clamps t', () => {
    expect(poseOf({ kind: 'slide', axis: [0, 1, 0], distance: 1 }, 2).position).toEqual([0, 1, 0])
    expect(poseOf({ kind: 'slide', axis: [0, 1, 0], distance: 1 }, -1).position).toEqual([0, 0, 0])
  })
})
