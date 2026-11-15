import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { RoomAvatar, TestRoom } from '@adatechnology/game-test-room'
import { createArsenal } from '@adatechnology/game-weapons'
import { createWeaponsTestModule } from '../src'

const stubRenderer = (): THREE.WebGLRenderer => {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

const roomWith = (tool: string): TestRoom => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const arsenal = createArsenal({ seed: 1, rules: { faults: false } })
  const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false, arsenal })
  room.loadModule(createWeaponsTestModule({ locale: 'en', sound: false, arsenal }))
  const avatar: RoomAvatar = { root: new THREE.Group(), update: () => undefined, strike: () => null }
  room.setAvatar(avatar)
  room.look([0, 1.7, 5], [0, 1.2, -11])
  room.setTool(tool)
  for (let elapsed = 0; elapsed < 0.6; elapsed += 0.02) room.update(0.02)
  return room
}

const handleOf = (room: TestRoom): THREE.Vector3 => {
  const viewmodel = room.scene.getObjectByName('weapon-in-hand')!
  viewmodel.updateWorldMatrix(true, true)
  return viewmodel.getObjectByName('handle')!.getWorldPosition(new THREE.Vector3())
}

describe('the melee tools the hands take by their handle: a closed grip, the palm on it', () => {
  it.each(['kabar', 'katana', 'brass_knuckles', 'machete', 'crowbar'])('%s: the grip of the right hand is closed (0.85 or more) and its palm is within 2 cm of the handle', (weapon) => {
    const room = roomWith(weapon)
    const targets = room.handState().targets!
    expect(targets.grip).toBeGreaterThanOrEqual(0.85)
    const palm = new THREE.Vector3(...targets.R!.position)
    expect(palm.distanceTo(handleOf(room))).toBeLessThan(0.02)
  })

  it('the katana is held with both hands: the left closes (0.85 or more) on the second mark of the handle, within 2 cm', () => {
    const room = roomWith('katana')
    const targets = room.handState().targets!
    expect(targets.L).not.toBeNull()
    expect(targets.gripL).toBeGreaterThanOrEqual(0.85)
    const viewmodel = room.scene.getObjectByName('weapon-in-hand')!
    const support = viewmodel.getObjectByName('support')!.getWorldPosition(new THREE.Vector3())
    expect(new THREE.Vector3(...targets.L!.position).distanceTo(support)).toBeLessThan(0.02)
  })
})
