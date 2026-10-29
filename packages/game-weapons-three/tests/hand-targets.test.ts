import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { RoomAvatar, RoomFirstPersonState, TestRoom } from '@adatechnology/game-test-room'
import type { HandTargets } from '@adatechnology/game-contracts'
import { createArsenal } from '@adatechnology/game-weapons'
import { createWeaponsTestModule } from '../src'

function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

/** A room whose first-person arms are a recorder: it keeps the last hand targets the room lent it. */
function roomWithRecorder(): { room: TestRoom; last: () => RoomFirstPersonState | null } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const arsenal = createArsenal({ seed: 1, rules: { faults: false } })
  const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false, arsenal })
  expect(room.loadModule(createWeaponsTestModule({ locale: 'en', sound: false, arsenal })).problems).toEqual([])
  let state: RoomFirstPersonState | null = null
  const avatar: RoomAvatar = {
    root: new THREE.Group(),
    update: () => undefined,
    firstPerson: { root: new THREE.Group(), update: (_dt, next) => void (state = { ...next }) },
    strike: () => null,
  }
  room.setAvatar(avatar)
  room.look([0, 1.7, 5], [0, 1.2, -11])
  return { room, last: () => state }
}
const run = (room: TestRoom, seconds: number): void => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.02) room.update(0.02)
}
const equip = (room: TestRoom, tool: string): void => {
  room.setTool(tool)
  run(room, 0.5)
}
const distance = (a: HandTargets['R'], b: HandTargets['R']): number => Math.hypot(a!.position[0] - b!.position[0], a!.position[1] - b!.position[1], a!.position[2] - b!.position[2])

describe('hand targets of the weapon in the hands', () => {
  it('a pistol gives both hands, the right on the grip and the left wrapped under it, with a closed grip', () => {
    const { room, last } = roomWithRecorder()
    equip(room, 'glock_17')
    const targets = last()!.targets!
    expect(targets).not.toBeNull()
    expect(targets.R).not.toBeNull()
    expect(targets.L).not.toBeNull()
    expect(targets.grip).toBeGreaterThan(0.5)
    expect(distance(targets.R, targets.L)).toBeLessThan(0.1)
    expect(last()!.stance).toBe('hold')
  })

  it('a rifle gives the right hand at the grip and the left far forward, on the handguard', () => {
    const { room, last } = roomWithRecorder()
    equip(room, 'ak_47')
    const targets = last()!.targets!
    expect(targets.R).not.toBeNull()
    expect(targets.L).not.toBeNull()
    expect(distance(targets.R, targets.L)).toBeGreaterThan(0.1)
    expect(distance(targets.R, targets.L)).toBeLessThan(0.7)
  })

  it('a pump gun puts the left hand on the pump and it moves with the pump', () => {
    const { room, last } = roomWithRecorder()
    equip(room, 'remington_870')
    const rest = last()!.targets!.L!.position.slice()
    room.use()
    run(room, 0.25)
    const during = last()!.targets!.L!.position
    expect(Math.hypot(during[0] - rest[0], during[1] - rest[1], during[2] - rest[2])).toBeGreaterThan(0.005)
  })

  it('the supporting hand goes to the magazine while it is changed and comes back', () => {
    const { room, last } = roomWithRecorder()
    equip(room, 'ak_47')
    const rest = last()!.targets!.L!.position.slice()
    room.use()
    run(room, 0.2)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }))
    let farthest = 0
    for (let i = 0; i < 100; i++) {
      room.update(0.02)
      const p = last()!.targets!.L!.position
      farthest = Math.max(farthest, Math.hypot(p[0] - rest[0], p[1] - rest[1], p[2] - rest[2]))
    }
    expect(farthest).toBeGreaterThan(0.03)
    run(room, 3)
    const back = last()!.targets!.L!.position
    expect(Math.hypot(back[0] - rest[0], back[1] - rest[1], back[2] - rest[2])).toBeLessThan(0.02)
  })

  it('a tool that is not a weapon from the module gives no hand targets from the weapons module', () => {
    const { room, last } = roomWithRecorder()
    equip(room, 'hand')
    const targets = last()?.targets ?? null
    expect(targets?.R ?? null).toBeNull()
  })

  it('the hold follows the weapon as the camera turns', () => {
    const { room, last } = roomWithRecorder()
    equip(room, 'glock_17')
    const first = last()!.targets!.R!.position.slice()
    room.look([0, 1.7, 5], [8, 1.2, -9])
    run(room, 0.1)
    const second = last()!.targets!.R!.position
    expect(Math.hypot(second[0] - first[0], second[1] - first[1], second[2] - first[2])).toBeGreaterThan(0.001)
  })

  it('a pistol reload takes the supporting hand off the grip, to the magazine, and back', () => {
    const { room, last } = roomWithRecorder()
    equip(room, 'glock_17')
    const rest = last()!.targets!.L!.position.slice()
    room.use()
    run(room, 0.2)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }))
    let farthest = 0
    for (let i = 0; i < 100; i++) {
      room.update(0.02)
      const p = last()!.targets!.L!.position
      farthest = Math.max(farthest, Math.hypot(p[0] - rest[0], p[1] - rest[1], p[2] - rest[2]))
    }
    expect(farthest).toBeGreaterThan(0.03)
    run(room, 3)
    const back = last()!.targets!.L!.position
    expect(Math.hypot(back[0] - rest[0], back[1] - rest[1], back[2] - rest[2])).toBeLessThan(0.02)
  })

  it('both hands of a pistol are inside the view, in front of the camera and not at the bottom edge', () => {
    const { room, last } = roomWithRecorder()
    equip(room, 'glock_17')
    const eye = room.camera
    for (const side of ['R', 'L'] as const) {
      const local = eye.worldToLocal(new THREE.Vector3(...last()!.targets![side]!.position))
      expect(local.z).toBeLessThan(-0.25)
      expect(Math.atan2(-local.y, -local.z)).toBeLessThan(0.55)
      expect(Math.abs(Math.atan2(local.x, -local.z))).toBeLessThan(0.5)
    }
  })

  it.each(['colt_m4a1', 'ak_47'])('%s: the left hand is under the handguard, past the receiver, about 60 percent of the way to its end', (weapon) => {
    const { room, last } = roomWithRecorder()
    equip(room, weapon)
    const viewmodel = room.scene.getObjectByName('weapon-viewmodel')!
    viewmodel.updateWorldMatrix(true, true)
    const inverse = viewmodel.matrixWorld.clone().invert()
    const box = new THREE.Box3().setFromObject(viewmodel).applyMatrix4(inverse)
    const left = new THREE.Vector3(...last()!.targets!.L!.position).applyMatrix4(inverse)
    const right = new THREE.Vector3(...last()!.targets!.R!.position).applyMatrix4(inverse)
    // the gun lies along -z of the viewmodel (muzzle at min z); the left hand is forward of the right and in the front half
    const along = (box.max.z - left.z) / (box.max.z - box.min.z)
    expect(left.z).toBeLessThan(right.z - 0.1)
    expect(along).toBeGreaterThan(0.6)
    expect(along).toBeLessThan(0.9)
    expect(left.y).toBeLessThan(0)
  })

  it.each(['colt_m4a1', 'ak_47'])('%s: the support hand is palm up, under the handguard axis', (weapon) => {
    const { room, last } = roomWithRecorder()
    equip(room, weapon)
    const viewmodel = room.scene.getObjectByName('weapon-viewmodel')!
    viewmodel.updateWorldMatrix(true, true)
    const inverse = viewmodel.matrixWorld.clone().invert()
    const world = viewmodel.getWorldQuaternion(new THREE.Quaternion())
    const pose = last()!.targets!.L!
    // the palm is the -y side of the hand frame; in the weapon's space it must face up
    const palm = new THREE.Vector3(0, -1, 0).applyQuaternion(new THREE.Quaternion(...pose.quaternion)).applyQuaternion(world.clone().invert())
    expect(palm.y).toBeGreaterThan(0.7)
    // the barrel axis: the middle height of what lies at the muzzle end
    const whole = new THREE.Box3().setFromObject(viewmodel).applyMatrix4(inverse)
    const heights: number[] = []
    viewmodel.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      const box = new THREE.Box3().setFromObject(mesh).applyMatrix4(inverse)
      if (box.min.z < whole.min.z + 0.05) heights.push((box.min.y + box.max.y) / 2)
    })
    const axis = heights.reduce((a, b) => a + b, 0) / heights.length
    const centre = new THREE.Vector3(...pose.position).applyMatrix4(inverse)
    expect(centre.y).toBeLessThan(axis - 0.015)
  })
})
