import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { DestructibleSpec } from '@adatechnology/game-contracts'
import { makeRoom } from './helpers'
import type { TestRoom } from '../src'

const SIDE = 0.7

const run = (room: TestRoom, seconds: number): void => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) room.update(1 / 60)
}

const blockSpec = (): DestructibleSpec => ({ name: 'Block', parts: [{ id: 'block', material: 'concrete', shape: { kind: 'box', size: [SIDE, SIDE, SIDE] }, position: [0, SIDE / 2, 0] }], joints: [] })

/** A room on one ground, with a concrete block of about 790 kg to put down on it. */
function roomOn(surface: string): TestRoom {
  const room = makeRoom({ ground: { surface } })
  room.loadModule({
    id: 'load',
    name: 'load',
    group: 'load',
    items: () => [{ id: 'heavy_block', name: 'Heavy block', spec: blockSpec, movable: true, build: () => {
      const root = new THREE.Group()
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(SIDE, SIDE, SIDE))
      mesh.name = 'block'
      mesh.position.y = SIDE / 2
      root.add(mesh)
      return root
    } }],
  })
  // the concrete over the bars is gone in a square of 2 m: the bars are bare there
  const { terrain } = room
  for (let row = 0; row <= terrain.rows; row++) {
    for (let column = 0; column <= terrain.columns; column++) {
      const x = terrain.bounds[0] + column * terrain.cellSize
      const z = terrain.bounds[1] + row * terrain.cellSize
      if (Math.abs(x) <= 1 && Math.abs(z - 2) <= 1) terrain.dug[row * terrain.stride + column] = 0.12
    }
  }
  return room
}

describe('weight standing still on the ground', () => {
  it('a block too heavy for the bare bars of a slab over a void goes through it, to the floor below', () => {
    const room = roomOn('suspended_slab')
    const block = room.spawn('heavy_block', [0, 0, 2])
    run(room, 3)
    const box = new THREE.Box3().setFromObject(block.root)
    expect(room.terrain.heightAt(0, 2)).toBeLessThan(-3)
    expect(box.min.y).toBeLessThan(-1)
    expect(room.log.toNDJSON()).toContain('ground_gave_way')
  })

  it('on a slab on the ground the same block only sags the bars, and the player alone only bends them a little', () => {
    const room = roomOn('concrete_slab')
    room.look([0, 1.7, 2], [0, 1.7, 0])
    run(room, 1)
    const centre = Math.round((2 - room.terrain.bounds[1]) / room.terrain.cellSize) * room.terrain.stride + Math.round(-room.terrain.bounds[0] / room.terrain.cellSize)
    const byPlayer = room.terrain.barBend[centre]!
    expect(byPlayer).toBeGreaterThan(0.05)
    expect(byPlayer).toBeLessThan(0.4)
    room.look([3, 1.7, 5], [0, 1.7, 0])
    room.spawn('heavy_block', [0, 0, 2])
    run(room, 3)
    expect(room.terrain.barBend[centre]!).toBeGreaterThan(1)
    expect(room.terrain.heightAt(0, 2)).toBeGreaterThan(-0.2)
  })
})
