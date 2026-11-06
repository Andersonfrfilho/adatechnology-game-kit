import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { createPlayerAvatar, toRoomAvatar } from '../src'
import { createHeadHider } from '../src/player/head-hiding'
import type { AvatarUpdate, PlayerAvatarOptions } from '../src'

const settle = (options: PlayerAvatarOptions = {}, state: AvatarUpdate = {}, seconds = 1) => {
  const avatar = createPlayerAvatar(THREE, options)
  for (let i = 0; i < seconds * 60; i++) avatar.update(1 / 60, state)
  return avatar
}
const range = (values: number[]): number => Math.max(...values) - Math.min(...values)

describe('eye', () => {
  it('stands about 1.70 m above the feet', () => {
    const eye = settle().eye()
    expect(eye.y).toBeGreaterThan(1.68)
    expect(eye.y).toBeLessThan(1.72)
  })

  it('follows the pose of the body: crouch, sit, lie, down', () => {
    const stand = settle().eye()
    const crouch = settle({}, { crouch: true }).eye()
    expect(crouch.y).toBeLessThan(stand.y - 0.2)
    const sit = settle({}, { seat: { pose: 'sit', hip: 0.48 } }).eye()
    expect(sit.y).toBeLessThan(stand.y - 0.2)
    expect(sit.y).toBeGreaterThan(0.48)
    const lie = settle({}, { seat: { pose: 'lie', hip: 0.6 } }).eye()
    expect(lie.y).toBeLessThan(1.0)
    expect(lie.z).toBeLessThan(stand.z - 0.5)
    const down = settle({}, { down: true }, 2).eye()
    expect(down.y).toBeLessThan(0.8)
  })

  it('falls the way it is told: face down ahead of the feet, on the back behind them', () => {
    const stand = settle().eye()
    const forward = settle({}, { down: true, fallForward: true }, 2).eye()
    const back = settle({}, { down: true, fallForward: false }, 2).eye()
    // the body's front is +z: face down lays the head ahead, on the back behind
    expect(forward.z).toBeGreaterThan(stand.z + 0.8)
    expect(back.z).toBeLessThan(stand.z - 0.8)
    expect(forward.y).toBeLessThan(0.6)
    expect(back.y).toBeLessThan(0.6)
    // the room's wrapper passes the side on (the room tells it which way a blast pushed)
    const roomFall = (fallForward: boolean) => {
      const room = toRoomAvatar(createPlayerAvatar(THREE))
      for (let i = 0; i < 120; i++) room.update(1 / 60, { speed: 0, running: false, crouch: false, down: true, fallForward, armed: false, pitch: 0 })
      return room.avatar.eye()
    }
    expect(roomFall(true).z).toBeGreaterThan(stand.z + 0.8)
    expect(roomFall(false).z).toBeLessThan(stand.z - 0.8)
  })

  it('moves with the head turning', () => {
    const avatar = settle()
    const before = avatar.eye().clone()
    avatar.rig.headG.rotation.x += 0.6
    avatar.root.updateMatrixWorld(true)
    const after = new THREE.Vector3()
    ;(avatar.rig.headG as unknown as THREE.Object3D).children[0]!.getObjectByName('eye')!.getWorldPosition(after)
    expect(after.distanceTo(before)).toBeGreaterThan(0.03)
  })

  it('follows eyeOffset in the head frame', () => {
    const base = settle({ eyeOffset: [0, 0, 0] }).eye()
    expect(base.y).toBeCloseTo(settle().eye().y + 0.068, 2)
    expect(settle({ eyeOffset: [0, 0, 0.1] }).eye().z).toBeGreaterThan(base.z + 0.05)
  })

  it('is not moved by a reach() made after update', () => {
    const avatar = settle({}, { armed: true, pitch: 0 })
    const before = avatar.eye().clone()
    avatar.reach({ R: { position: [0.6, 2.4, -1.5], quaternion: [0, 0, 0, 1] }, L: { position: [-0.6, 2.4, -1.5], quaternion: [0, 0, 0, 1] } } as never)
    expect(avatar.eye().distanceTo(before)).toBe(0)
    const live = new THREE.Vector3()
    avatar.root.getObjectByName('eye')!.getWorldPosition(live)
    expect(live.distanceTo(before)).toBeGreaterThan(0.005) // the reach does swing the head: reading it live would be wrong
  })

  it('stays right when the host moves the root after update', () => {
    const avatar = settle()
    const before = avatar.eye().clone()
    avatar.root.position.set(3, 0, -2)
    expect(avatar.eye().distanceTo(before.add(new THREE.Vector3(3, 0, -2)))).toBeLessThan(1e-9)
  })
})

describe('eyeBob', () => {
  const swing = (eyeBob: number): number => {
    const avatar = createPlayerAvatar(THREE, { eyeBob })
    for (let i = 0; i < 30; i++) avatar.update(1 / 60, { speed: 1.4 })
    const heights: number[] = []
    for (let i = 0; i < 60; i++) {
      avatar.update(1 / 60, { speed: 1.4 })
      heights.push(avatar.eye().y)
    }
    return range(heights)
  }

  it('lets none, half or all of the body bob reach the eye', () => {
    const none = swing(0)
    const half = swing(0.5)
    const all = swing(1)
    expect(none).toBeLessThan(0.004)
    expect(all).toBeGreaterThan(0.015)
    expect(half).toBeGreaterThan(none)
    expect(half).toBeLessThan(all)
  })
})

type Hook = (renderer: unknown, scene: unknown, camera: unknown, geometry: unknown, material: unknown, group: unknown) => void

const hiddenObjects = (avatar: ReturnType<typeof createPlayerAvatar>): THREE.Object3D[] => {
  const out: THREE.Object3D[] = []
  const roots = [avatar.rig.headG, ...(avatar.rig.neck ? [avatar.rig.neck] : [])] as unknown as THREE.Object3D[]
  for (const root of roots) root.traverse((o) => { const f = o as THREE.Mesh & THREE.Sprite & THREE.Points; if (f.isMesh || f.isSprite || f.isPoints) out.push(o) })
  return out
}
const materialsOf = (object: THREE.Object3D): THREE.Material[] => {
  const material = (object as THREE.Mesh).material
  return Array.isArray(material) ? material : [material]
}
// what the hooks see of the renderer: the eye clip switches its local clipping on
const renderer = { localClippingEnabled: false }
const before = (object: THREE.Object3D, camera: unknown): void => {
  const mesh = object as THREE.Mesh
  ;(mesh.onBeforeRender as unknown as Hook)(renderer, null, camera, null, materialsOf(object)[0], null)
}
const after = (object: THREE.Object3D, camera: unknown): void => {
  const mesh = object as THREE.Mesh
  ;(mesh.onAfterRender as unknown as Hook)(renderer, null, camera, null, materialsOf(object)[0], null)
}

describe('setView', () => {
  const viewCamera = new THREE.PerspectiveCamera()
  const otherCamera = new THREE.PerspectiveCamera()

  it('hides the head and the neck for the view camera only, and restores them', () => {
    const avatar = settle()
    avatar.setView('first', viewCamera)
    const objects = hiddenObjects(avatar)
    expect(objects.length).toBeGreaterThan(5)
    expect(objects).toContain(avatar.rig.neck)
    for (const object of objects) {
      before(object, viewCamera)
      for (const material of materialsOf(object)) {
        expect(material.colorWrite).toBe(false)
        expect(material.depthWrite).toBe(false)
        expect(material.visible).toBe(true)
      }
      after(object, viewCamera)
      for (const material of materialsOf(object)) {
        expect(material.colorWrite).toBe(true)
        expect(material.depthWrite).toBe(true)
      }
    }
  })

  it('leaves other cameras, the third person view and no camera alone', () => {
    const avatar = settle()
    const objects = hiddenObjects(avatar)
    const untouched = (camera: unknown): void => {
      for (const object of objects) {
        before(object, camera)
        for (const material of materialsOf(object)) expect(material.colorWrite).toBe(true)
        after(object, camera)
      }
    }
    avatar.setView('first', viewCamera)
    untouched(otherCamera)
    avatar.setView('third', viewCamera)
    untouched(viewCamera)
    avatar.setView('first', null)
    untouched(viewCamera)
  })

  it('brings a material shared with the hands back intact', () => {
    const avatar = settle()
    avatar.setView('first', viewCamera)
    const hidden = hiddenObjects(avatar)
    const hands = new Set<THREE.Material>()
    avatar.hand('R').parent!.traverse((o) => { if ((o as THREE.Mesh).isMesh) hands.add((o as THREE.Mesh).material as THREE.Material) })
    const shared = hidden.flatMap(materialsOf).filter((material) => hands.has(material))
    expect(shared.length).toBeGreaterThan(0)
    for (const object of hidden) {
      before(object, viewCamera)
      after(object, viewCamera)
    }
    for (const material of shared) expect(material.colorWrite && material.depthWrite).toBe(true)
  })

  it('chains the hooks an object already had', () => {
    const calls: string[] = []
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
    mesh.onBeforeRender = () => calls.push('before')
    mesh.onAfterRender = () => calls.push('after')
    const group = new THREE.Group().add(mesh)
    const hider = createHeadHider([group])
    hider.setView('first', viewCamera)
    before(mesh, viewCamera)
    expect((mesh.material as THREE.Material).colorWrite).toBe(false)
    after(mesh, viewCamera)
    expect(calls).toEqual(['before', 'after'])
    expect((mesh.material as THREE.Material).colorWrite).toBe(true)
  })

  it('hides the arms too for a view that draws arms of its own (`arms`), and only then', () => {
    const avatar = settle()
    const arms: THREE.Object3D[] = []
    for (const arm of avatar.rig.arms) (arm.g as unknown as THREE.Object3D).traverse((o) => { if ((o as THREE.Mesh).isMesh) arms.push(o) })
    expect(arms.length).toBeGreaterThan(4)
    const drawn = (): boolean[] => arms.map((object) => {
      before(object, viewCamera)
      const shown = materialsOf(object).every((material) => material.colorWrite)
      after(object, viewCamera)
      return shown
    })
    avatar.setView('first', viewCamera)
    expect(drawn().every(Boolean)).toBe(true)
    avatar.setView('first', viewCamera, { arms: true })
    expect(drawn().some(Boolean)).toBe(false)
    avatar.setView('third', viewCamera, { arms: true })
    expect(drawn().every(Boolean)).toBe(true)
  })
})

describe('lens', () => {
  const states: [string, AvatarUpdate][] = [
    ['standing', {}],
    ['crouched', { crouch: true }],
    ['down', { down: true }],
    ['seat sit', { seat: { pose: 'sit', hip: 0.48 } }],
    ['seat lie', { seat: { pose: 'lie', hip: 0.6 } }],
    ['push', { push: { phase: 'push', progress: 1 } }],
    ['armed level', { armed: true, pitch: 0 }],
    ['armed down', { armed: true, pitch: -0.8 }],
    ['holding', { holding: true }],
  ]

  it.each(states)('keeps the body clear of the lens: %s', (_name, state) => {
    const avatar = settle({}, state, 2)
    avatar.root.updateMatrixWorld(true)
    const eye = avatar.eye()
    const excluded = new Set<THREE.Object3D>()
    const exclude = (node: unknown): void => (node as THREE.Object3D).traverse((o) => excluded.add(o))
    exclude(avatar.rig.headG)
    if (avatar.rig.neck) exclude(avatar.rig.neck)
    for (const arm of avatar.rig.arms) exclude(arm.el)
    // the nearest vertex, not the bounding box: a leaning torso has a loose box
    const near: number[] = []
    const vertex = new THREE.Vector3()
    avatar.root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || excluded.has(o)) return
      const position = mesh.geometry.getAttribute('position')
      for (let i = 0; i < position.count; i++) near.push(vertex.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld).distanceTo(eye))
    })
    expect(Math.min(...near)).toBeGreaterThan(0.1)
  })
})

describe('eye clip', () => {
  const viewCamera = new THREE.PerspectiveCamera()
  const otherCamera = new THREE.PerspectiveCamera()
  const torsoMeshes = (avatar: ReturnType<typeof createPlayerAvatar>): THREE.Mesh[] => {
    const head = new Set(hiddenObjects(avatar))
    const out: THREE.Mesh[] = []
    ;(avatar.rig.upper as unknown as THREE.Object3D).traverse((o) => { if ((o as THREE.Mesh).isMesh && !head.has(o)) out.push(o as THREE.Mesh) })
    return out
  }
  const planeWhileDrawn = (mesh: THREE.Mesh, camera: unknown): THREE.Plane | null => {
    before(mesh, camera)
    const plane = materialsOf(mesh)[0]!.clippingPlanes?.[0] ?? null
    const copy = plane ? plane.clone() : null
    after(mesh, camera)
    return copy
  }
  const inBody = (avatar: ReturnType<typeof createPlayerAvatar>, x: number, y: number, z: number): THREE.Vector3 =>
    (avatar.rig.upper as unknown as THREE.Object3D).localToWorld(new THREE.Vector3(x, y - 0.9, z))

  it('cuts the shoulders and the back for the first-person camera and keeps the chest, the belly and the legs', () => {
    const avatar = settle()
    avatar.setView('first', viewCamera)
    avatar.root.updateMatrixWorld(true)
    const meshes = torsoMeshes(avatar)
    expect(meshes.length).toBeGreaterThan(3)
    const plane = planeWhileDrawn(meshes[0]!, viewCamera)
    expect(plane).not.toBeNull()
    // the top of the shoulders and the back of the collar are behind the eyes: a real head hides them from its own eyes
    expect(plane!.distanceToPoint(inBody(avatar, 0.2, 1.5, 0))).toBeLessThan(0)
    expect(plane!.distanceToPoint(inBody(avatar, 0, 1.55, -0.1))).toBeLessThan(0)
    // the front of the chest and the belly are in front: a look down sees them
    expect(plane!.distanceToPoint(inBody(avatar, 0, 1.3, 0.17))).toBeGreaterThan(0)
    expect(plane!.distanceToPoint(inBody(avatar, 0, 1.05, 0.16))).toBeGreaterThan(0)
    expect(renderer.localClippingEnabled).toBe(true)
    // the legs are not cut at all
    let leg: THREE.Mesh | null = null
    for (const l of avatar.rig.legs as unknown as Array<{ g: THREE.Object3D }>) l.g.traverse((o) => { if (!leg && (o as THREE.Mesh).isMesh) leg = o as THREE.Mesh })
    expect(planeWhileDrawn(leg!, viewCamera)).toBeNull()
  })

  it('puts the plane back after the draw, and leaves other cameras and the third person whole', () => {
    const avatar = settle()
    const mesh = torsoMeshes(avatar)[0]!
    avatar.setView('first', viewCamera)
    planeWhileDrawn(mesh, viewCamera)
    expect(materialsOf(mesh)[0]!.clippingPlanes).toBeNull()
    expect(planeWhileDrawn(mesh, otherCamera)).toBeNull()
    avatar.setView('third', viewCamera)
    expect(planeWhileDrawn(mesh, viewCamera)).toBeNull()
  })
})
