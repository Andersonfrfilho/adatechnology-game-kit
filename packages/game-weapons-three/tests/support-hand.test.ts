import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { RoomAvatar, RoomFirstPersonState, TestRoom } from '@adatechnology/game-test-room'
import { createArsenal } from '@adatechnology/game-weapons'
import { createWeaponsTestModule } from '../src'

function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}
function setup(): { room: TestRoom; last: () => RoomFirstPersonState } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const arsenal = createArsenal({ seed: 1, rules: { faults: false } })
  const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false, arsenal })
  expect(room.loadModule(createWeaponsTestModule({ locale: 'en', sound: false, arsenal })).problems).toEqual([])
  let state: RoomFirstPersonState | null = null
  const avatar: RoomAvatar = { root: new THREE.Group(), update: () => undefined, firstPerson: { root: new THREE.Group(), update: (_dt, next) => void (state = { ...next }) }, strike: () => null }
  room.setAvatar(avatar)
  room.look([0, 1.7, 5], [0, 1.2, -11])
  return { room, last: () => state! }
}

// The support hand of a long gun at rest is a cup under the handguard: palm up, the wrist low and to the left, the fingers going right and up its right side, the thumb forward.
describe('the support hand under a handguard', () => {
  it.each(['colt_m4a1', 'ak_47', 'hk416', 'hk_mp5a3', 'fn_minimi', 'thompson_m1a1'])('%s: palm up, fingers up the right side, wrist below the fingers, the hand under the barrel', (id) => {
    const { room, last } = setup()
    room.setTool(id)
    for (let i = 0; i < 60; i++) room.update(1 / 60)
    const left = last().targets!.L!
    const turn = new THREE.Quaternion(...left.quaternion)
    const fingers = new THREE.Vector3(1, 0, 0).applyQuaternion(turn)
    const back = new THREE.Vector3(0, 1, 0).applyQuaternion(turn)
    // the player looks down -z, so its right is +x
    expect(fingers.x, 'the fingers go to the right').toBeGreaterThan(0.85)
    expect(fingers.y, 'and rise, so the wrist is below them').toBeGreaterThan(0.35)
    expect(back.y, 'the back of the hand is down: the palm is up').toBeLessThan(-0.8)
    const muzzle = room.scene.getObjectByName('weapon-viewmodel')!.getObjectByName('muzzle')!
    muzzle.updateWorldMatrix(true, false)
    expect(left.position[1], 'under the barrel').toBeLessThan(muzzle.getWorldPosition(new THREE.Vector3()).y - 0.03)
    // the wrist (behind the palm along the fingers) is lower than the palm
    const wrist = new THREE.Vector3(...left.position).addScaledVector(fingers, -0.07)
    expect(wrist.y).toBeLessThan(left.position[1] - 0.02)
  })
})
