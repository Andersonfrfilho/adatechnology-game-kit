import { expect } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { RoomAvatar, TestRoom } from '@adatechnology/game-test-room'

type HandState = ReturnType<TestRoom['handState']>
import { createArsenal } from '@adatechnology/game-weapons'
import { createWeaponsTestModule } from '../../src'
export function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

export const arsenal = createArsenal({ seed: 1, rules: { faults: false } })

export function setup(): { room: TestRoom; last: () => HandState } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false, arsenal })
  expect(room.loadModule(createWeaponsTestModule({ locale: 'en', sound: false, arsenal })).problems).toEqual([])
  const avatar: RoomAvatar = { root: new THREE.Group(), update: () => undefined, strike: () => null }
  room.setAvatar(avatar)
  room.look([0, 1.7, 5], [0, 1.2, -11])
  return { room, last: () => room.handState() }
}
export const step = (room: TestRoom, frames: number, each?: () => void): void => {
  for (let i = 0; i < frames; i++) {
    room.update(1 / 60)
    each?.()
  }
}
export const keyR = (): boolean => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }))
