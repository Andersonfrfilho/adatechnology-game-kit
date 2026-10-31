import { defaultCharacterClips } from '@adatechnology/game-kit-defaults'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { TestRoom, TestRoomItem, TestRoomOptions } from '@adatechnology/game-test-room'

import { createPlayerAvatar, toRoomAvatar } from '../src'

const stubRenderer = (): THREE.WebGLRenderer => {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

const SEAT_HEIGHT = 0.45
const bench: TestRoomItem = {
  id: 'bench',
  name: 'Bench',
  group: 'Test',
  build: (T) => {
    const root = new T.Group()
    const seat = new T.Mesh(new T.BoxGeometry(1.4, 0.06, 0.45), new T.MeshStandardMaterial())
    seat.position.y = SEAT_HEIGHT - 0.03
    root.add(seat)
    return root
  },
  spec: { name: 'bench', parts: [{ id: 'seat', material: 'wood_hard', mass: 18, shape: { kind: 'box', size: [1.4, 0.06, 0.45] }, position: [0, SEAT_HEIGHT - 0.03, 0] }], joints: [] },
  movable: false,
  seats: [{ id: 'left', pose: 'sit', pos: [-0.4, SEAT_HEIGHT, 0], ry: 0, exit: [-0.4, 0, 0.8] }],
}
const cup: TestRoomItem = {
  id: 'cup',
  name: 'Cup',
  group: 'Test',
  build: (T) => new T.Mesh(new T.CylinderGeometry(0.04, 0.035, 0.1, 12), new T.MeshStandardMaterial()),
  spec: { name: 'cup', parts: [{ id: 'body', material: 'ceramic', mass: 0.3, shape: { kind: 'cylinder', radius: 0.04, height: 0.1 }, position: [0, 0.05, 0] }], joints: [] },
  movable: true,
  fluid: { container: { capacity: 0.4, liquid: 'water', liters: 0.3, temperature: 18, shape: { kind: 'cylinder', radius: 0.04, height: 0.1 }, opening: 0.04 }, part: 'body', uses: ['drink', 'sip', 'pour'], offset: [0, 0.01, 0] },
}

const setup = (scenery: TestRoomOptions['scenery'] = { table: null, shelf: null }): { room: TestRoom; avatar: ReturnType<typeof createPlayerAvatar> } => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({ THREE, container, locale: 'en', catalog: [bench, cup], renderer: stubRenderer(), ui: false, scenery })
  const avatar = createPlayerAvatar(THREE)
  room.setAvatar(toRoomAvatar(avatar, defaultCharacterClips()))
  return { room, avatar }
}

/** Hands, knees and head of the body in the world. */
const pose = (avatar: ReturnType<typeof createPlayerAvatar>): number[] => {
  const v = new THREE.Vector3()
  const at = (o: THREE.Object3D): number[] => o.getWorldPosition(v).toArray()
  const rig = avatar.rig
  return [...at(avatar.hand('R')), ...at(avatar.hand('L')), ...rig.legs.flatMap((leg) => at(leg.kn as unknown as THREE.Object3D)), ...at(rig.headG as unknown as THREE.Object3D)]
}
const frames = (room: TestRoom, n: number): void => {
  for (let i = 0; i < n; i++) room.update(1 / 60)
}

/** The body after one more frame in the other view is where it was: the view only changes where the picture is taken from. */
const sameInBothViews = (room: TestRoom, avatar: ReturnType<typeof createPlayerAvatar>, keep: () => void = () => undefined): void => {
  room.setCameraMode('first')
  keep()
  frames(room, 1)
  const first = pose(avatar)
  room.setCameraMode('third')
  keep()
  frames(room, 1)
  const third = pose(avatar)
  room.setCameraMode('first')
  keep()
  frames(room, 1)
  const back = pose(avatar)
  // one frame of animation goes by between the samples: the third-person sample must sit between them as the frames do, never off the path by a view
  third.forEach((value, index) => {
    const lo = Math.min(first[index]!, back[index]!) - 0.01
    const hi = Math.max(first[index]!, back[index]!) + 0.01
    expect(value, `component ${index}`).toBeGreaterThanOrEqual(lo)
    expect(value, `component ${index}`).toBeLessThanOrEqual(hi)
  })
}

describe('one body for both views (spec 004, R7)', () => {
  it('the first-person camera is the body\'s eye, about 1.70 m standing, and the body is drawn', () => {
    const { room, avatar } = setup()
    room.look([0, 1.7, 3], [0, 1.7, -5])
    // a scripted view is kept as asked until the player moves; a step hands the view to the body's eye
    room.walk([0, 0, 2.6], 0.3)
    frames(room, 30)
    const eye = avatar.eye()
    expect(room.camera.position.distanceTo(eye)).toBeLessThan(1e-6)
    expect(room.camera.position.y).toBeCloseTo(1.7, 1)
    expect(avatar.root.visible).toBe(true)
  })

  it('standing, walking, crouched, armed, carrying and seated: switching views moves neither the hands, the feet nor the head', () => {
    const { room, avatar } = setup()
    room.look([0, 1.7, 3], [0, 1.7, -5])
    frames(room, 30)
    sameInBothViews(room, avatar)

    room.setAvatarState({ crouch: true })
    frames(room, 30)
    sameInBothViews(room, avatar)
    room.setAvatarState({ crouch: false })

    room.setTool('pistol_9mm')
    frames(room, 30)
    sameInBothViews(room, avatar)
    room.setTool('hand')

    room.look([0, 1.7, 3], [0, 0.05, 2])
    room.spawn('cup', [0, 0, 2], 0)
    expect(room.grab()).toBe(true)
    frames(room, 30)
    sameInBothViews(room, avatar)
    room.throwHeld(0.5)
    frames(room, 30)

    const so = room.spawn('bench', [3, 0, 0], 0)
    room.look([2.6, 1.7, 1], [2.6, 0.5, 0])
    expect(room.sit(so.objectId)).not.toBeNull()
    frames(room, 30)
    sameInBothViews(room, avatar)
    // seated, the eye is the body's: lower than standing and over the seat
    expect(room.camera.position.y).toBeLessThan(1.5)
    expect(room.camera.position.y).toBeGreaterThan(SEAT_HEIGHT + 0.4)
    room.stand()
    frames(room, 30)

    room.look([0, 1.7, 3], [0, 1.7, -5])
    room.walk([0, 0, -2], 1.4)
    frames(room, 20)
    sameInBothViews(room, avatar, () => room.walk([0, 0, -2], 1.4))
  })

  it('crouched, the camera is the body\'s crouched eye (about 1.3 to 1.4 m), not the player\'s own crouch drop', () => {
    const { room, avatar } = setup()
    room.look([0, 1.7, 3], [0, 1.7, -5])
    room.walk([0, 0, 2.6], 0.3)
    frames(room, 30)
    room.setAvatarState({ crouch: true })
    frames(room, 60)
    expect(room.camera.position.distanceTo(avatar.eye())).toBeLessThan(1e-6)
    expect(room.camera.position.y).toBeGreaterThan(1.25)
    expect(room.camera.position.y).toBeLessThan(1.45)
    room.setAvatarState({ crouch: false })
    frames(room, 60)
    expect(room.camera.position.y).toBeCloseTo(1.7, 1)
  })

  it('pushing a low piece, the camera follows the body\'s bend and the player\'s own eye is not lowered', () => {
    const crate = { name: 'crate', parts: [{ id: 'body', material: 'wood_soft', mass: 20, shape: { kind: 'box' as const, size: [0.8, 0.5, 0.6] as [number, number, number] }, position: [0, 0.25, 0] as [number, number, number] }], joints: [] }
    const { room, avatar } = setup({ crate: { spec: crate, position: [0, 0, -2], free: true, pushable: true }, table: null, shelf: null })
    room.look([0, 1.7, -1.1], [0, 0.3, -2])
    room.walk([0, 0, -1.1], 0.3)
    frames(room, 30)
    const standing = room.camera.position.y
    expect(room.push.begin()).toBe(true)
    frames(room, 120)
    expect(room.push.state).not.toBeNull()
    expect(room.camera.position.distanceTo(avatar.eye())).toBeLessThan(1e-6)
    expect(room.camera.position.y).toBeLessThan(standing - 0.2)
    // the body bends like a crouch: no further drop on top of its pose
    expect(room.camera.position.y).toBeGreaterThan(1.0)
    room.push.end()
  })

  it.each(['first', 'third'] as const)('a carried item is at the body\'s right hand in %s person and the body\'s arm raises it to drink', (mode) => {
    const { room, avatar } = setup()
    room.look([0, 1.7, 3], [0, 0.05, 2])
    room.spawn('cup', [0, 0, 2], 0)
    expect(room.grab()).toBe(true)
    room.setCameraMode(mode)
    frames(room, 60)
    const itemAt = (): THREE.Vector3 => new THREE.Box3().setFromObject(room.spawned()[0]!.root).getCenter(new THREE.Vector3())
    const hand = avatar.hand('R').getWorldPosition(new THREE.Vector3())
    const rest = itemAt()
    expect(new THREE.Box3().setFromObject(room.spawned()[0]!.root).distanceToPoint(hand)).toBeLessThan(0.12)
    expect(room.useItem('drink')).toBe(true)
    let top = rest.y
    for (let i = 0; i < 60; i++) {
      room.update(1 / 60)
      top = Math.max(top, itemAt().y)
    }
    expect(top - rest.y).toBeGreaterThan(0.2)
  })
})
