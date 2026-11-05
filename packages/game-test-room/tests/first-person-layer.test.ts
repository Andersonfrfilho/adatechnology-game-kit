import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { FIRST_PERSON_LAYER } from '@adatechnology/game-contracts'
import type { HandTargets, ModuleHost } from '@adatechnology/game-contracts'
import type { RoomFirstPersonArms } from '../src'
import { makeRoom } from './helpers'

const TARGETS: HandTargets = { R: { position: [0.2, 1.3, -0.4], quaternion: [0, 0, 0, 1] }, grip: 1 }

const fakeArms = (): RoomFirstPersonArms & { readonly seen: Array<HandTargets | null | undefined> } => {
  const root = new THREE.Group()
  root.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial()))
  const seen: Array<HandTargets | null | undefined> = []
  return { root, seen, update: (_dt, state) => void seen.push(state.targets), dispose: () => undefined }
}

describe('the first-person layer', () => {
  it('keeps the world camera off the layer, and draws the first-person arms on it with the hands of the tool', () => {
    const arms = fakeArms()
    const room = makeRoom({ firstPersonArms: arms })
    let host: ModuleHost | null = null
    room.loadModule({ id: 'gun', name: 'Gun', group: 'Test', items: () => [], attach: (lent) => ((host = lent), lent.setHandTargets?.(() => TARGETS) ?? (() => undefined)) })
    room.setTool('glock_17')
    room.update(1 / 60)
    expect(room.camera.layers.isEnabled(FIRST_PERSON_LAYER)).toBe(false)
    expect(arms.root.parent).toBe(room.scene)
    expect(arms.root.visible).toBe(true)
    expect(arms.seen.at(-1)).toEqual(TARGETS)
    let onLayer = 0
    arms.root.traverse((node) => (onLayer += node.layers.mask === 1 << FIRST_PERSON_LAYER ? 1 : 0))
    expect(onLayer).toBe(2)
    expect(typeof host!.setViewmodelFov).toBe('function')
    room.dispose()
  })

  it('hides the first-person arms in third person', () => {
    const arms = fakeArms()
    const room = makeRoom({ firstPersonArms: arms })
    const viewArms: Array<boolean | undefined> = []
    room.setAvatar({ root: new THREE.Group(), update: () => undefined, setView: (_mode, _camera, options) => void viewArms.push(options?.arms) })
    room.setCameraMode('third')
    expect(arms.root.visible).toBe(false)
    room.setCameraMode('first')
    expect(arms.root.visible).toBe(true)
    // the body's arms are kept out of the eye, which sees the first-person ones
    expect(viewArms.at(-1)).toBe(true)
    room.dispose()
  })
})

describe('the kick of a shot', () => {
  it('turns the view up and brings most of it back down over a fraction of a second', () => {
    const room = makeRoom()
    room.look([0, 1.6, 2], [0, 1.6, -11])
    room.setTool('glock_17')
    for (let i = 0; i < 30; i++) room.update(1 / 60)
    const pitch = (): number => new THREE.Euler().setFromQuaternion(room.camera.quaternion, 'YXZ').x
    const before = pitch()
    let status = room.use()
    for (let i = 0; i < 120 && status !== 'ok'; i++) {
      room.update(1 / 60)
      status = room.use()
    }
    expect(status).toBe('ok')
    const kicked = pitch() - before
    expect(kicked).toBeGreaterThan(0)
    for (let i = 0; i < 60; i++) room.update(1 / 60)
    const left = pitch() - before
    expect(left).toBeGreaterThan(0)
    expect(left).toBeLessThan(kicked * 0.4)
    room.dispose()
  })
})
