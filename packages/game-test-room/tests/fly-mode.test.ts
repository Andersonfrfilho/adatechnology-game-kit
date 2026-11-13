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

describe('fly mode (modo livre / noclip)', () => {
  it('KeyM toggles flying mode on and off', () => {
    const r = room()
    expect(r.flying).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' }))
    expect(r.flying).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' }))
    expect(r.flying).toBe(false)
  })

  it('while flying, Space ascends and stays suspended in place without gravity', () => {
    const r = room()
    r.setFly(true)
    expect(r.flying).toBe(true)
    const initialFeet = r.playerPosition[1]

    // Press Space to fly up
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
    for (let i = 0; i < 30; i++) r.update(1 / 60)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))

    const highFeet = r.playerPosition[1]
    expect(highFeet).toBeGreaterThan(initialFeet + 0.5)

    // Release keys and let 60 frames pass: player stays suspended in mid-air (no gravity)
    for (let i = 0; i < 60; i++) r.update(1 / 60)
    expect(r.playerPosition[1]).toBeCloseTo(highFeet, 2)
  })
})
