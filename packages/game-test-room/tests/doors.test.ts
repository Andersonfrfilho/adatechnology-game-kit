import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { AnimationClipSpec, TestableModule } from '@adatechnology/game-contracts'
import type { DestructibleSpec } from '@adatechnology/game-destruction'
import type { ScenarioContext } from '../src'
import { makeRoom } from './helpers'

const OPEN = 1.4
/** A cabinet 0.8 m wide with one door hinged on its left edge that swings out toward +z. */
const open: AnimationClipSpec = { id: 'open_door', duration: 1, keys: [{ t: 0, parts: { door: { rotation: [0, 0, 0] } } }, { t: 1, parts: { door: { rotation: [0, -OPEN, 0] } } }] }
const close: AnimationClipSpec = { id: 'close_door', duration: 1, keys: [{ t: 0, parts: { door: { rotation: [0, -OPEN, 0] } } }, { t: 1, parts: { door: { rotation: [0, 0, 0] } } }] }
const spec: DestructibleSpec = {
  name: 'cabinet',
  parts: [
    { id: 'body', material: 'mdf', mass: 30, shape: { kind: 'box', size: [0.8, 1.6, 0.5] }, position: [0, 0.8, 0] },
    { id: 'door', material: 'mdf', mass: 6, shape: { kind: 'box', size: [0.8, 1.5, 0.02] }, position: [-0.4, 0.8, 0.26] },
  ],
  joints: [{ id: 'hinge', a: 'body', b: 'door', kind: 'hinge' }],
}
const cabinet = (): TestableModule<ScenarioContext> => ({
  id: 'cabinets',
  name: 'Cabinets',
  group: 'Cabinets',
  items: () => [
    {
      id: 'cabinet',
      name: 'Cabinet',
      build: (T) => {
        const three = T as typeof THREE
        const g = new three.Group()
        const body = new three.Mesh(new three.BoxGeometry(0.8, 1.6, 0.5), new three.MeshStandardMaterial())
        body.position.set(0, 0.8, 0)
        g.add(body)
        // the door's origin is its hinge
        const door = new three.Group()
        door.name = 'door'
        door.position.set(-0.4, 0.8, 0.26)
        const leaf = new three.Mesh(new three.BoxGeometry(0.8, 1.5, 0.02), new three.MeshStandardMaterial())
        leaf.position.set(0.4, 0, 0)
        door.add(leaf)
        g.add(door)
        return g
      },
      spec,
      movable: false,
      animations: [open, close],
    },
  ],
  scenarios: () => [],
})

const run = (room: ReturnType<typeof makeRoom>, seconds: number): void => {
  for (let i = 0; i < seconds * 60; i++) room.update(1 / 60)
}
const types = (room: ReturnType<typeof makeRoom>): string[] => room.log.entries().filter((e) => e.type.startsWith('door_')).map((e) => e.type)

function setup() {
  const sounds: string[] = []
  const room = makeRoom({ onSound: (k) => sounds.push(k), scenery: { table: null, shelf: null } })
  room.loadModule(cabinet())
  const so = room.spawn('cabinet', [0, 0, -4], 0)
  return { room, so, sounds, door: so.root.getObjectByName('door')! }
}

describe('opening by hand', () => {
  it('finds the leaves of an item from its open clips', () => {
    const { room, so } = setup()
    expect(room.leaves(so.objectId)).toEqual(['door'])
  })

  it('E on the door opens it along its clip, and E again closes it, with the latch, the hinge and the leaf meeting the frame', () => {
    const { room, so, door, sounds } = setup()
    room.look([0.2, 1.7, -2.6], [0.2, 1.1, -3.74])
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }))
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }))
    expect(room.door?.phase).toBe('reach')
    run(room, 2)
    expect(room.leafOpening(so.objectId)).toBe(1)
    expect(door.rotation.y).toBeCloseTo(-OPEN, 5)
    expect(room.door).toBeNull()
    expect(sounds).toEqual(expect.arrayContaining(['leaf_latch', 'leaf_creak_wood']))
    // the eye now rests inside the cabinet: the open door is the one E closes
    room.look([0.2, 1.7, -2.6], [0.2, 1.1, -3.9])
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }))
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }))
    run(room, 2)
    expect(room.leafOpening(so.objectId)).toBe(0)
    expect(door.rotation.y).toBeCloseTo(0, 5)
    expect(sounds).toContain('leaf_shut_wood')
    expect(types(room)).toEqual(['door_reach', 'door_opened', 'door_reach', 'door_closed'])
  })

  it('the hand goes to the free edge of the leaf and follows it, and the body takes the pose', () => {
    const { room, so } = setup()
    room.setAvatar({ root: new THREE.Group(), update: () => undefined })
    room.look([0.2, 1.7, -2.6], [0.2, 1.1, -3.74])
    expect(room.useLeaf(so.objectId)).toBe(true)
    // the player walks first: beside the free edge, clear of the arc the door sweeps, a little out in front
    run(room, 0.2)
    expect(room.avatarState().door).toMatchObject({ phase: 'reach', progress: 0 })
    for (let i = 0; i < 120 && room.avatarState().door?.phase !== 'swing'; i++) room.update(1 / 60)
    expect(room.avatarState().door).toMatchObject({ phase: 'swing', pull: true })
    const [x, , z] = room.playerPosition
    expect(Math.hypot(x - -0.4, z - (-4 + 0.26))).toBeGreaterThan(0.8 + 0.25)
    expect(z).toBeGreaterThan(-4 + 0.26)
  })

  it('a locked door rattles and does not move', () => {
    const { room, so, door, sounds } = setup()
    room.lockLeaf(so.objectId)
    expect(room.useLeaf(so.objectId)).toBe(true)
    run(room, 1)
    expect(room.leafOpening(so.objectId)).toBe(0)
    expect(door.rotation.y).toBe(0)
    expect(sounds).toContain('leaf_rattle')
    expect(types(room)).toEqual(['door_locked'])
    room.lockLeaf(so.objectId, false)
    room.useLeaf(so.objectId)
    run(room, 4)
    expect(room.leafOpening(so.objectId)).toBe(1)
  })

  it('a door stops at what is in its way', () => {
    const { room, so } = setup()
    // an old TV where the free edge of the door passes
    room.spawn('old_tv', [0.15, 0, -3.3], 0)
    room.look([1.5, 1.7, -2.5], [0, 1.1, -3.74])
    room.useLeaf(so.objectId)
    run(room, 2)
    const opening = room.leafOpening(so.objectId)
    expect(opening).toBeGreaterThan(0.05)
    expect(opening).toBeLessThan(0.9)
    expect(types(room)).toContain('door_blocked')
  })
})
