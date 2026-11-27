import { describe, expect, it } from 'vitest'

import type { JoltWorld } from '@adatechnology/game-physics-jolt'

import { demoItems } from './fixtures/demo-items'
import { makeRoom } from './helpers'
import { roomPhysics } from './support/room-physics'

/**
 * The test rooms stand on Jolt worlds that a test's helper hands out and the setup file frees (CLAUDE.md §8): the wasm heap is fixed (128 MB, ~20 MB for an empty world and
 * ~40 MB with a room on it), so a suite that made a room per test without freeing would run out in a handful of them. Rooms made one after another, each freed with its world,
 * leave the heap where it was.
 */
describe('the heap of the rooms the tests make', () => {
  it('twenty rooms made and freed one after another do not grow the heap', () => {
    const used: number[] = []
    let heapTotal = 0
    for (let made = 0; made < 20; made++) {
      const loop = roomPhysics()
      const world = loop.world as unknown as JoltWorld
      heapTotal = world.memoryTotal()
      const room = makeRoom({ physics: loop, catalog: demoItems('en') })
      room.spawn('wooden_crate', [0, 0, -3], 0)
      for (let frame = 0; frame < 30; frame++) room.update(1 / 60)
      room.dispose()
      // the setup file keeps the last four worlds alive, so the heap is read once that ring is full
      if (made >= 4) used.push(world.memoryInUse())
    }
    const spread = Math.max(...used) - Math.min(...used)
    expect(spread).toBeLessThan(heapTotal * 0.02)
    expect(Math.max(...used)).toBeLessThan(heapTotal * 0.9)
  })
})
