import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { IN_HAND_NODE_NAME, VIEWMODEL_NODE_NAME, createLaserRaycast, isVisibleInScene } from '../src/laser-raycast'

const wall = (z: number, parent: THREE.Object3D): THREE.Mesh => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 0.1), new THREE.MeshBasicMaterial())
  mesh.position.set(0, 0, z)
  parent.add(mesh)
  mesh.updateMatrixWorld(true)
  return mesh
}

const setup = (): { scene: THREE.Scene; camera: THREE.PerspectiveCamera; time: { now: number }; cast: () => number | null } => {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera()
  const time = { now: 0 }
  const raycast = createLaserRaycast(THREE, scene, camera, { now: () => time.now })
  const cast = (): number | null => raycast(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1), 50)
  return { scene, camera, time, cast }
}

describe('the laser raycast', () => {
  it('skips a mesh whose ancestor is hidden, though the mesh itself is visible', () => {
    const { scene, time, cast } = setup()
    const room = new THREE.Group()
    scene.add(room)
    wall(-10, room)
    const hiddenGroup = new THREE.Group()
    scene.add(hiddenGroup)
    const near = wall(-3, hiddenGroup)
    hiddenGroup.visible = false
    expect(near.visible).toBe(true)
    expect(isVisibleInScene(near)).toBe(false)
    expect(cast()).toBeCloseTo(9.95, 2)
    hiddenGroup.visible = true
    time.now += 100
    expect(cast()).toBeCloseTo(2.95, 2)
  })

  it('ignores the weapon in the hands under either node name', () => {
    for (const name of [VIEWMODEL_NODE_NAME, IN_HAND_NODE_NAME]) {
      const { scene, cast } = setup()
      wall(-10, scene)
      const hand = new THREE.Group()
      hand.name = name
      scene.add(hand)
      wall(-1, hand)
      expect(cast(), name).toBeCloseTo(9.95, 2)
    }
  })

  it('casts at most 30 times a second and keeps the last distance in between', () => {
    const { scene, time, cast } = setup()
    const near = wall(-3, scene)
    expect(cast()).toBeCloseTo(2.95, 2)
    near.position.z = -6
    near.updateMatrixWorld(true)
    time.now += 10
    expect(cast()).toBeCloseTo(2.95, 2)
    time.now += 30
    expect(cast()).toBeCloseTo(5.95, 2)
  })
})
