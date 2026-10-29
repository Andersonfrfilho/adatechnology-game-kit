import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createTestRoom } from '../src'
import { demoItems } from './fixtures/demo-items'
import { stubRenderer } from './helpers'

const scaledCan = {
  id: 'scaled_can',
  name: 'Scaled can',
  group: 'probe',
  movable: true,
  // a model drawn in "page units" (a can 0.7 wide) and sized to metres by the scale of its root, like the showcase models of game-items-three
  build: () => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.6), new THREE.MeshStandardMaterial({ name: 'steel' }))
    mesh.position.y = 0.3
    const inner = new THREE.Group()
    inner.add(mesh)
    const root = new THREE.Group()
    root.scale.setScalar(0.1)
    root.add(inner)
    return root
  },
}

function roomWith(extra = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return createTestRoom({ THREE, container, locale: 'en', catalog: [...demoItems('en'), scaledCan], renderer: stubRenderer(), ui: false, ...extra })
}

describe('an item whose builder scales the root', () => {
  it('is read in metres: the piece box and the mass are those of the can the eye sees', () => {
    const room = roomWith()
    const can = room.spawn('scaled_can', [0, 0, -4], 0)
    const piece = room.renderer.piece(can.objectId)!
    expect(piece.halfExtents[1]).toBeLessThan(0.05)
    expect(piece.mass).toBeLessThan(5)
    expect(can.root.scale.x).toBe(1)
  })
})

describe('an explosion shoves what is around it', () => {
  it('throws a loose item away, less the farther it is; a heavy one that is not fixed becomes a piece and moves; a fixed one stays', () => {
    const room = roomWith({ maxCarryKg: 3 })
    const near = room.spawn('steel_drum', [2, 0, -6], 0)
    const far = room.spawn('steel_drum', [-5, 0, -6], 0)
    const heavy = room.spawn('chair', [0, 0, -3], 0)
    expect(heavy.movable).toBe(false)
    expect(room.renderer.piece(heavy.objectId)).toBeNull()
    for (let i = 0; i < 60; i++) room.update(1 / 60)
    room.renderer.explode([0, 0.3, -6], 150000, 9, { visual: false })
    for (let i = 0; i < 20; i++) room.update(1 / 60)
    expect(near.root.position.x).toBeGreaterThan(2.5)
    const nearMove = near.root.position.x - 2
    const farMove = -5 - far.root.position.x
    expect(farMove).toBeGreaterThan(0)
    expect(nearMove).toBeGreaterThan(farMove)
    expect(room.renderer.piece(heavy.objectId)).not.toBeNull()
    expect(room.log.toText()).toMatch(/heavy but free/)
  })

  it('takes the numbers from the options of the room, which modules read from the host', () => {
    const room = roomWith({ blastShove: { maxSpeed: 0.1 } })
    const drum = room.spawn('steel_drum', [2, 0, -6], 0)
    for (let i = 0; i < 60; i++) room.update(1 / 60)
    room.renderer.explode([0, 0.3, -6], 150000, 9, { visual: false })
    for (let i = 0; i < 20; i++) room.update(1 / 60)
    expect(drum.root.position.x - 2).toBeLessThan(0.1)
    let seen: unknown
    room.loadModule({ id: 'probe', name: 'probe', group: 'probe', items: () => [], attach: (host) => { seen = host.blastShove; return () => undefined } })
    expect(seen).toEqual({ maxSpeed: 0.1 })
  })
})
