import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '../src'
import type { RoomAvatar, TestRoom } from '../src'
import { stubRenderer } from './helpers'

const room = (): TestRoom => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const created = createTestRoom({ THREE, container, catalog: [], renderer: stubRenderer(), ui: false })
  const avatar: RoomAvatar = { root: new THREE.Group(), update: () => undefined, hand: () => new THREE.Object3D() }
  created.setAvatar(avatar)
  created.look([0, 1.7, 5], [0, 1.7, -10])
  return created
}
const settle = (r: TestRoom): void => {
  for (let i = 0; i < 90; i++) r.update(1 / 60)
}
const pressAndRelease = (r: TestRoom, seconds: number): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC' }))
  for (let i = 0; i < seconds * 60; i++) r.update(1 / 60)
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyC' }))
}
/** The height of the eye the mode shows: the third person's camera exists only for the render. */
const viewHeight = (r: TestRoom): number => {
  const restore = r.applyCamera()
  const height = r.camera.position.y
  restore()
  return height
}

describe.each(['first', 'third'] as const)('crouching with C in %s person', (mode) => {
  const start = (): { r: TestRoom; standing: number } => {
    const r = room()
    r.setCameraMode(mode)
    settle(r)
    return { r, standing: viewHeight(r) }
  }

  it('a tap stays crouched and the next tap stands up', () => {
    const { r, standing } = start()
    pressAndRelease(r, 0.08)
    settle(r)
    expect(r.avatarState().crouch).toBe(true)
    expect(viewHeight(r)).toBeLessThan(standing - 0.4)
    pressAndRelease(r, 0.08)
    settle(r)
    expect(r.avatarState().crouch).toBe(false)
    expect(viewHeight(r)).toBeCloseTo(standing, 1)
  })

  it('a long press crouches only while it is held', () => {
    const { r, standing } = start()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC' }))
    settle(r)
    expect(r.avatarState().crouch).toBe(true)
    expect(viewHeight(r)).toBeLessThan(standing - 0.4)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyC' }))
    settle(r)
    expect(r.avatarState().crouch).toBe(false)
    expect(viewHeight(r)).toBeCloseTo(standing, 1)
  })

  it('a long press after a tap stands up on release', () => {
    const { r } = start()
    pressAndRelease(r, 0.08)
    pressAndRelease(r, 0.6)
    settle(r)
    expect(r.avatarState().crouch).toBe(false)
  })
})
