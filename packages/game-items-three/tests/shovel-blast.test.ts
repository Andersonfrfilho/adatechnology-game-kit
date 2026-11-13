import { createGoodsItems, goodsText } from '@adatechnology/game-items-goods'
import { createTestRoom } from '@adatechnology/game-test-room'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createItemsTestModule, ITEM_PREFIX } from '../src'

const stubRenderer = (): THREE.WebGLRenderer =>
  ({ domElement: document.createElement('canvas'), shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined }) as unknown as THREE.WebGLRenderer

describe('a hand grenade 0.8 m from the shovel of the goods catalog, lying on the floor of the items room', () => {
  it('throws it at single-digit speed without spinning it like a propeller, and it comes down and rests', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false })
    room.loadModule(createItemsTestModule({ catalog: createGoodsItems(), locale: 'en', translate: goodsText }))
    const { root, objectId } = room.spawn(`${ITEM_PREFIX}shovel`, [0, 0.03, -2.2], Math.PI / 2)
    for (let i = 0; i < 30; i++) room.update(1 / 60)
    const piece = room.renderer.piece(objectId)!
    expect(piece.mass).toBeCloseTo(2, 1)
    room.blastAt('m67', [0.8, 0.05, -2.3])
    room.update(1 / 60)
    expect(Math.hypot(...(piece.velocity as [number, number, number]))).toBeLessThan(12)
    expect(piece.velocity[1]).toBeLessThan(6)
    expect(Math.hypot(...(piece.angularVelocity as [number, number, number]))).toBeLessThan(30)
    let highest = 0
    let towardCharge = 0
    for (let i = 0; i < 420; i++) {
      room.update(1 / 60)
      highest = Math.max(highest, root.position.y)
      // the charge is at +x of the shovel: after the wave nothing pulls it back toward it
      towardCharge = Math.max(towardCharge, piece.velocity[0])
    }
    expect(towardCharge).toBeLessThan(0.05)
    expect(root.position.x).toBeLessThan(-1)
    expect(highest).toBeLessThan(3)
    expect(Math.hypot(...(piece.velocity as [number, number, number]))).toBeLessThan(0.1)
    expect(Math.hypot(root.position.x, root.position.z + 2.2)).toBeLessThan(12)
  })

  it('shows the handle it broke: the handle meshes are hidden and its splinters are drawn, the blade stays', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false })
    room.loadModule(createItemsTestModule({ catalog: createGoodsItems(), locale: 'en', translate: goodsText }))
    const { root, objectId } = room.spawn(`${ITEM_PREFIX}shovel`, [0, 0.03, -2.2], Math.PI / 2)
    for (let i = 0; i < 30; i++) room.update(1 / 60)
    const shown = (): boolean[] => {
      const out: boolean[] = []
      root.traverse((child) => (child as THREE.Mesh).isMesh && out.push(child.visible))
      return out
    }
    expect(shown().every(Boolean)).toBe(true)
    room.blastAt('m67', [0.8, 0.05, -2.3])
    for (let i = 0; i < 60; i++) room.update(1 / 60)
    expect(room.world.part(objectId, 'handle')?.status).toBe('broken')
    const after = shown()
    expect(after.some((visible) => !visible)).toBe(true)
    expect(after.some(Boolean)).toBe(true)
    expect(room.renderer.stats().fragments).toBeGreaterThan(10)
  })
})
