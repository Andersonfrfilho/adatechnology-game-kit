import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '../src'
import type { DestructibleSpec } from '@adatechnology/game-destruction'
import type { RoomAvatar, RoomAvatarState, TestRoom } from '../src'
import { thirdPersonPose, THIRD_PERSON_DEFAULTS } from '../src/avatar'
import { stubRenderer } from './helpers'

const crate: DestructibleSpec = { name: 'crate', parts: [{ id: 'body', material: 'wood_soft', shape: { kind: 'box', size: [0.4, 0.4, 0.4] }, position: [0, 0.2, 0] }], joints: [] }
const crateItem = {
  id: 'crate',
  name: 'Crate',
  group: 'Test',
  build: (T: unknown) => {
    const three = T as typeof THREE
    const m = new three.Mesh(new three.BoxGeometry(0.4, 0.4, 0.4), new three.MeshStandardMaterial())
    m.name = 'body'
    m.position.y = 0.2
    const g = new three.Group()
    g.add(m)
    return g
  },
  spec: crate,
}

type Fake = RoomAvatar & { calls: Array<{ dt: number; state: RoomAvatarState }>; handSocket: THREE.Object3D }

const fakeAvatar = (): Fake => {
  const root = new THREE.Group()
  const handSocket = new THREE.Object3D()
  handSocket.position.set(0.3, 1.1, -0.4)
  root.add(handSocket)
  const calls: Fake['calls'] = []
  return { root, calls, handSocket, update: (dt, state) => void calls.push({ dt, state: { ...state } }), hand: () => handSocket }
}

const room = (extra = {}): TestRoom => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return createTestRoom({ THREE, container, catalog: [], renderer: stubRenderer(), ui: false, ...extra })
}
const key = (code: string, init: KeyboardEventInit = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { code, ...init }))

describe('thirdPersonPose (the team game shoulder camera)', () => {
  const free = () => null
  it('stands back 3.8 m and 0.9 m to the right of a player facing -z', () => {
    const pose = thirdPersonPose({ x: 0, z: 0, feet: 0, yaw: 0, pitch: 0, crouch: false }, THIRD_PERSON_DEFAULTS, free)
    expect(pose.pivot[0]).toBeCloseTo(0.9)
    expect(pose.pivot[1]).toBeCloseTo(1.95)
    expect(pose.pivot[2]).toBeCloseTo(0)
    expect(pose.position[0]).toBeCloseTo(0.9)
    expect(pose.position[1]).toBeCloseTo(2.05)
    expect(pose.position[2]).toBeCloseTo(3.8)
    expect(pose.direction[2]).toBeCloseTo(-1)
  })
  it('crouching lowers the pivot to 1.4 m', () => {
    expect(thirdPersonPose({ x: 0, z: 0, feet: 0, yaw: 0, pitch: 0, crouch: true }, THIRD_PERSON_DEFAULTS, free).pivot[1]).toBeCloseTo(1.4)
  })
  it('a wall pulls the camera in 0.3 m short, never closer than 0.2 m', () => {
    const wall = (distance: number) => () => distance
    const input = { x: 0, z: 0, feet: 0, yaw: 0, pitch: 0, crouch: false }
    expect(thirdPersonPose(input, THIRD_PERSON_DEFAULTS, wall(2)).free).toBeCloseTo(1.7)
    expect(thirdPersonPose(input, THIRD_PERSON_DEFAULTS, wall(0.1)).free).toBeCloseTo(0.2)
  })
})

describe('room avatar', () => {
  it('puts the body at the feet with the yaw, hidden in first person and shown in third', () => {
    const r = room()
    const a = fakeAvatar()
    r.setAvatar(a)
    expect(r.avatar).toBe(a)
    expect(r.scene.children).toContain(a.root)
    expect(a.root.visible).toBe(false)
    r.look([2, 1.7, 3], [2, 1.7, -10])
    r.update(1 / 60)
    expect(a.root.position.x).toBeCloseTo(2)
    expect(a.root.position.z).toBeCloseTo(3)
    expect(a.root.position.y).toBe(0)
    r.setCameraMode('third')
    expect(a.root.visible).toBe(true)
    r.setAvatar(null)
    expect(r.scene.children).not.toContain(a.root)
  })

  it('gives the avatar speed, running, armed, pitch and the state a module sets', () => {
    const r = room()
    const a = fakeAvatar()
    r.setAvatar(a)
    r.look([0, 1.7, 5], [0, 1.7, -10])
    for (let i = 0; i < 5; i++) r.update(1 / 60)
    expect(a.calls.at(-1)!.state).toMatchObject({ speed: 0, crouch: false, down: false, armed: false })
    r.walk([0, 0, 0], 0)
    for (let i = 0; i < 30; i++) {
      r.walk([0, 0, 5 - (i + 1) * 0.05], 0) // 3 m/s at 60 fps
      r.update(1 / 60)
    }
    expect(a.calls.at(-1)!.state.speed).toBeGreaterThan(1.5)
    r.setTool('glock_17')
    r.setAvatarState({ crouch: true, down: true })
    r.update(1 / 60)
    expect(a.calls.at(-1)!.state).toMatchObject({ armed: true, crouch: true, down: true })
    expect(r.avatarState()).toMatchObject({ crouch: true, down: true })
    r.setAvatarState({ armed: false })
    r.update(1 / 60)
    expect(a.calls.at(-1)!.state.armed).toBe(false)
    r.setAvatarState({ armed: null })
    r.update(1 / 60)
    expect(a.calls.at(-1)!.state.armed).toBe(true)
  })

  it('a teleport is not a stride', () => {
    const r = room()
    const a = fakeAvatar()
    r.setAvatar(a)
    r.update(1 / 60)
    r.look([9, 1.7, 9], [9, 1.7, 0])
    r.update(1 / 60)
    expect(a.calls.at(-1)!.state.speed).toBe(0)
  })

  it('V toggles the view when a body is set, logs it and tells the listeners; without a body V stays the kick', () => {
    const r = room()
    const seen: unknown[] = []
    r.on('camera', (m) => seen.push(m))
    key('KeyV')
    expect(r.cameraMode).toBe('first')
    r.setAvatar(fakeAvatar())
    key('KeyV')
    expect(r.cameraMode).toBe('third')
    key('KeyV')
    expect(r.cameraMode).toBe('first')
    expect(seen).toEqual(['third', 'first'])
    const entries = r.log.entries({ channel: 'action', type: 'camera' })
    expect(entries.map((e) => e.data?.mode)).toEqual(['third', 'first'])
    expect(entries[0]!.text).toBe('View: 3rd person')
  })

  it('the log line is in pt-BR with that locale', () => {
    const r = room({ locale: 'pt-BR' })
    r.setAvatar(fakeAvatar())
    r.setCameraMode('third')
    expect(r.log.entries({ type: 'camera' })[0]!.text).toBe('Câmera: 3ª pessoa')
  })

  it('shows the camera behind the player for the render only, and puts it back', () => {
    const r = room()
    r.setAvatar(fakeAvatar())
    r.look([0, 1.7, 5], [0, 1.7, -10])
    r.setCameraMode('third')
    const eye = r.camera.position.clone()
    const restore = r.applyCamera()
    expect(r.camera.position.z).toBeGreaterThan(eye.z + 3)
    expect(r.camera.position.x).toBeCloseTo(eye.x + 0.9, 1)
    restore()
    expect(r.camera.position.distanceTo(eye)).toBeLessThan(1e-9)
    r.setCameraMode('first')
    const restoreFirst = r.applyCamera()
    expect(r.camera.position.distanceTo(eye)).toBeLessThan(1e-9)
    restoreFirst()
  })

  it('the camera does not go through the wall behind the player', () => {
    const r = room()
    r.setAvatar(fakeAvatar())
    const wallZ = (r.world.state('target_wall') as unknown as { position?: [number, number, number] } | null)?.position?.[2] ?? -13
    r.look([0, 1.7, wallZ + 1.6], [0, 1.7, wallZ + 10]) // back to the target wall
    r.setCameraMode('third')
    const restore = r.applyCamera()
    expect(r.camera.position.z).toBeGreaterThan(wallZ)
    expect(r.camera.position.z).toBeLessThan(wallZ + 1.6 + 3.7)
    restore()
  })

  it('shots keep leaving the eye toward what the camera sees', () => {
    const r = room({ catalog: [crateItem] })
    r.setAvatar(fakeAvatar())
    r.spawn('crate', [0, 0, -4], 0)
    r.look([0, 1.7, 0], [0, 0.2, -4])
    r.setCameraMode('third')
    r.setTool('glock_17')
    r.waitUntilReady()
    const before = r.tool.ammo
    r.use()
    expect(r.tool.ammo).toBe(before - 1)
    expect(r.log.entries({ type: 'shoot' })).toHaveLength(1)
    expect(r.log.entries({ type: 'hole' }).length + r.log.entries({ type: 'dent' }).length).toBeGreaterThan(0)
  })

  it('a carried item follows the avatar hand in third person', () => {
    const r = room({ catalog: [crateItem] })
    const a = fakeAvatar()
    r.setAvatar(a)
    r.look([0, 1.7, 0], [0, 0.2, -1.5])
    r.spawn('crate', [0, 0, -1.5], 0)
    r.setCameraMode('third')
    expect(r.grab()).toBe(true)
    for (let i = 0; i < 120; i++) r.update(1 / 60)
    const hand = a.handSocket.getWorldPosition(new THREE.Vector3())
    const crateRoot = r.spawned()[0]!.root
    expect(crateRoot.position.distanceTo(hand)).toBeLessThan(0.6)
    r.setCameraMode('first')
    for (let i = 0; i < 120; i++) r.update(1 / 60)
    expect(crateRoot.position.distanceTo(hand)).toBeGreaterThan(0.6)
  })
})
