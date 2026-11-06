import { itemModels } from '@adatechnology/game-items-three'
import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { RoomAvatar, TestRoom } from '@adatechnology/game-test-room'
import type { HandPose } from '@adatechnology/game-contracts'
import { createArsenal } from '@adatechnology/game-weapons'

import { createWeaponsTestModule } from '../src'
import { IN_HAND_NODE_NAME, VIEWMODEL_NODE_NAME } from '../src/laser-raycast'

vi.setConfig({ testTimeout: 60_000 })

const VIEWS = ['first', 'third'] as const
// the palm sits a palm and half a grip off the grip's middle: it touches the grip it holds, never the other gun
const PALM_ON_GRIP = 0.03

function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

let canvas: HTMLCanvasElement = document.createElement('canvas')
function makeRoom(): TestRoom {
  const renderer = stubRenderer()
  canvas = renderer.domElement
  const container = document.createElement('div')
  document.body.appendChild(container)
  const arsenal = createArsenal({ seed: 1, rules: { faults: false } })
  const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer, ui: false, arsenal })
  expect(room.loadModule(createWeaponsTestModule({ locale: 'en', sound: false, arsenal, items: itemModels })).problems).toEqual([])
  const avatar: RoomAvatar = { root: new THREE.Group(), update: () => undefined, strike: () => null }
  room.setAvatar(avatar)
  room.look([0, 1.7, 5], [0, 1.2, -11])
  return room
}
const run = (room: TestRoom, seconds: number): void => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.02) room.update(0.02)
}
const twoOf = (room: TestRoom, right: string, left = right): void => {
  room.setTool(right)
  expect(room.setOffTool(left)).toBe(true)
  run(room, 0.6)
}
/** The presentations in the hands that hold a model now (gallery viewmodel or prop), by the side of the view they are on. */
const heldModels = (room: TestRoom): THREE.Object3D[] =>
  room.scene.children.filter((node) => {
    if (node.name !== VIEWMODEL_NODE_NAME && node.name !== IN_HAND_NODE_NAME) return false
    let meshes = 0
    node.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) meshes++
    })
    return meshes > 0
  })
const boxOf = (node: THREE.Object3D): THREE.Box3 => {
  node.updateWorldMatrix(true, true)
  return new THREE.Box3().setFromObject(node)
}
const sideOf = (room: TestRoom, point: THREE.Vector3): number => room.camera.worldToLocal(point.clone()).x
const at = (pose: HandPose | null | undefined): THREE.Vector3 => new THREE.Vector3(...(pose?.position ?? [Number.NaN, Number.NaN, Number.NaN]))
const fireWhenReady = (fire: () => string, room: TestRoom): string => {
  let status = ''
  for (let i = 0; i < 240 && status !== 'ok'; i++) {
    if (i > 0) room.update(1 / 60)
    status = fire()
  }
  return status
}
const tracerStart = (scene: THREE.Scene): THREE.Vector3 | null => {
  let start: THREE.Vector3 | null = null
  scene.traverse((o) => {
    const line = o as THREE.Line
    if (!line.isLine || !line.visible || (line.material as THREE.LineBasicMaterial).color?.getHex() !== 0xffe9a8) return
    start = new THREE.Vector3().fromBufferAttribute(line.geometry.getAttribute('position') as THREE.BufferAttribute, 0)
  })
  return start
}

describe('a weapon in each hand', () => {
  it.each(['glock_17', 'mini_uzi', 'machete'])('%s: each hand on the grip of its own weapon, the right one on the right and the left one on the left, in both views', (weapon) => {
    const room = makeRoom()
    for (const view of VIEWS) {
      room.setCameraMode(view)
      twoOf(room, weapon)
      const targets = room.handState().targets
      expect(targets?.R, `${view} R`).toBeTruthy()
      expect(targets?.L, `${view} L`).toBeTruthy()
      const right = at(targets?.R)
      const left = at(targets?.L)
      expect(sideOf(room, right), view).toBeGreaterThan(sideOf(room, left) + 0.15)
      const models = heldModels(room)
      expect(models.length, view).toBe(2)
      const [own, other] = [...models].sort((a, b) => sideOf(room, boxOf(b).getCenter(new THREE.Vector3())) - sideOf(room, boxOf(a).getCenter(new THREE.Vector3())))
      // the right hand on the right gun, the left hand on the left gun: on the grip, far from the other
      expect(boxOf(own!).distanceToPoint(right), `${view} right palm to its grip`).toBeLessThan(PALM_ON_GRIP)
      expect(boxOf(other!).distanceToPoint(left), `${view} left palm to its grip`).toBeLessThan(PALM_ON_GRIP)
      expect(boxOf(other!).distanceToPoint(right), view).toBeGreaterThan(0.1)
      expect(boxOf(own!).distanceToPoint(left), view).toBeGreaterThan(0.1)
    }
    room.dispose()
  })

  it('each button fires its own hand: the shot of the left hand leaves the muzzle on the left, in both views', () => {
    const room = makeRoom()
    for (const view of VIEWS) {
      room.setCameraMode(view)
      twoOf(room, 'uzi')
      room.look([0, 1.6, 2], [0, 1.2, -11])
      room.update(1 / 60)
      const right = room.tool
      const left = room.offTool!
      const full = right.capacity
      expect(fireWhenReady(() => room.use(), room)).toBe('ok')
      const rightStart = tracerStart(room.scene)!
      expect(right.ammo).toBeLessThan(full)
      expect(left.ammo).toBe(left.capacity)
      run(room, 0.5)
      expect(fireWhenReady(() => room.useOff(), room)).toBe('ok')
      const leftStart = tracerStart(room.scene)!
      expect(left.ammo).toBeLessThan(left.capacity)
      expect(sideOf(room, rightStart), view).toBeGreaterThan(0.05)
      expect(sideOf(room, leftStart), view).toBeLessThan(-0.05)
      const shots = room.log.entries({ type: 'shoot' })
      expect(shots.at(-1)?.data).toMatchObject({ weapon: 'uzi', hand: 'L' })
      run(room, 0.5)
    }
    room.dispose()
  })

  it('the right button is the trigger of the left hand: it does not aim, and the view does not zoom', () => {
    const room = makeRoom()
    twoOf(room, 'glock_17')
    room.look([0, 1.6, 2], [0, 1.2, -11])
    const fov = (room.camera as THREE.PerspectiveCamera).fov
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true, cancelable: true }))
    run(room, 0.4)
    window.dispatchEvent(new MouseEvent('mouseup', { button: 2 }))
    run(room, 0.2)
    expect(room.offTool!.ammo).toBeLessThan(room.offTool!.capacity)
    expect(room.tool.ammo).toBe(room.tool.capacity)
    expect((room.camera as THREE.PerspectiveCamera).fov).toBeCloseTo(fov, 6)
    room.dispose()
  })

  it('reloads each weapon on its own, the right one first and the left one after', () => {
    const room = makeRoom()
    twoOf(room, 'glock_17')
    room.look([0, 1.6, 2], [0, 1.2, -11])
    expect(fireWhenReady(() => room.use(), room)).toBe('ok')
    run(room, 0.3)
    expect(fireWhenReady(() => room.useOff(), room)).toBe('ok')
    room.reload()
    // the left gun is tucked away first, to free the hand that changes the right one's magazine
    run(room, 0.5)
    expect(room.tool.reloading).toBe(true)
    expect(room.offTool!.reloading).toBe(false)
    let seconds = 0
    while (room.tool.reloading && seconds < 10) {
      room.update(0.05)
      seconds += 0.05
    }
    run(room, 1.2)
    expect(room.offTool!.reloading).toBe(true)
    run(room, 6)
    expect(room.tool.ammo).toBe(room.tool.capacity)
    expect(room.offTool!.ammo).toBe(room.offTool!.capacity)
    room.dispose()
  })

  it('takes no rifle, and a plain pick goes back to one weapon in two hands', () => {
    const room = makeRoom()
    room.setTool('ak_47')
    expect(room.setOffTool('glock_17')).toBe(false)
    room.setTool('glock_17')
    expect(room.setOffTool('ak_47')).toBe(false)
    twoOf(room, 'glock_17')
    room.setTool('glock_17')
    run(room, 0.6)
    expect(room.offTool).toBeNull()
    const targets = room.handState().targets
    // one pistol again: both hands on its grip
    expect(at(targets?.R).distanceTo(at(targets?.L))).toBeLessThan(0.1)
    room.dispose()
  })

  it.each(VIEWS)('%s: a magazine change frees a hand: the other weapon is tucked low against the body, the free hand goes to the magazine well and back', (view) => {
    const room = makeRoom()
    room.setCameraMode(view)
    twoOf(room, 'glock_17')
    room.look([0, 1.6, 2], [0, 1.2, -11])
    expect(fireWhenReady(() => room.use(), room)).toBe('ok')
    run(room, 0.3)
    expect(fireWhenReady(() => room.useOff(), room)).toBe('ok')
    run(room, 0.3)
    const held = heldModels(room)
    const sideX = (node: THREE.Object3D): number => sideOf(room, boxOf(node).getCenter(new THREE.Vector3()))
    const [rightGun, leftGun] = [...held].sort((a, b) => sideX(b) - sideX(a))
    const leftRestY = boxOf(leftGun!).getCenter(new THREE.Vector3()).y
    room.reload()
    // the left gun tucked (0.45 s) and the right one reloading: the left hand on the right gun's magazine well
    run(room, 0.8)
    expect(room.tool.reloading).toBe(true)
    expect(boxOf(leftGun!).getCenter(new THREE.Vector3()).y).toBeLessThan(leftRestY - 0.15)
    const leftPalm = at(room.handState().targets?.L)
    expect(boxOf(rightGun!).distanceToPoint(leftPalm)).toBeLessThan(0.05)
    expect(boxOf(leftGun!).distanceToPoint(leftPalm)).toBeGreaterThan(0.1)
    expect(room.useOff()).toBe('reloading')
    // then the right gun is tucked and the right hand changes the left one's magazine
    let seconds = 0
    while (!(room.offTool!.reloading) && seconds < 6) {
      run(room, 0.1)
      seconds += 0.1
    }
    run(room, 0.3)
    const rightPalm = at(room.handState().targets?.R)
    expect(boxOf(leftGun!).distanceToPoint(rightPalm)).toBeLessThan(0.05)
    run(room, 6)
    const targets = room.handState().targets
    expect(boxOf(rightGun!).distanceToPoint(at(targets?.R))).toBeLessThan(PALM_ON_GRIP)
    expect(boxOf(leftGun!).distanceToPoint(at(targets?.L))).toBeLessThan(PALM_ON_GRIP)
    expect(Math.abs(boxOf(leftGun!).getCenter(new THREE.Vector3()).y - leftRestY)).toBeLessThan(0.02)
    expect(room.tool.ammo).toBe(room.tool.capacity)
    expect(room.offTool!.ammo).toBe(room.offTool!.capacity)
    room.dispose()
  })

  it('the index finger of the left hand is on its trigger and curls when that hand fires', () => {
    const room = makeRoom()
    twoOf(room, 'glock_17')
    room.look([0, 1.6, 2], [0, 1.2, -11])
    run(room, 2)
    expect(room.handState().targets?.fingersL?.index ?? 1).toBeLessThan(0.1)
    expect(fireWhenReady(() => room.useOff(), room)).toBe('ok')
    room.update(1 / 60)
    expect(room.handState().targets?.fingersL?.index ?? 0).toBeGreaterThan(0.45)
    expect(room.handState().targets?.fingers?.index ?? 1).toBeLessThan(0.1)
    room.dispose()
  })
})
