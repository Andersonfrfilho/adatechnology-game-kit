import * as THREE from 'three'
import { createFilmLcg } from '@adatechnology/game-fluids'
import { DEFERRED_QUEUE_ID, checkDeferredQueue } from '@adatechnology/game-contracts'
import { describe, expect, it, vi } from 'vitest'

import { createFilmManager } from '../src'

function setup() {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera()
  camera.position.set(0, 1.6, 4)
  const manager = createFilmManager(THREE, { scene, camera, random: createFilmLcg(7), fluids: { splash: vi.fn() } as never, now: () => 0 })
  const grids = [0, 1].map((i) => manager.launch({ fluid: 'blood', point: [i * 3 - 1.5, 0.4, 0], radius: 5 })!)
  return { manager, grids }
}

describe('the film queue', () => {
  it('is the fluids.film queue and keeps the DeferredQueue contract', () => {
    const { manager } = setup()
    const queue = manager.deferredQueue()
    expect(queue.id).toBe(DEFERRED_QUEUE_ID.FLUID_FILM)
    queue.attach?.()
    expect(checkDeferredQueue(queue, () => manager.update(1 / 60)).problems).toEqual([])
  })

  it('with no budget attached, update advances every grid by the frame time, nearest first', () => {
    const { manager, grids } = setup()
    const spies = grids.map((grid) => vi.spyOn(grid, 'update'))
    manager.update(0.016)
    expect(spies.map((spy) => spy.mock.calls.length)).toEqual([1, 1])
    expect(spies[0]?.mock.calls[0]?.[0]).toBeCloseTo(0.016, 9)
    expect(manager.deferredQueue().pending()).toBe(0)
  })

  it('attached, update only opens the frame: the queue advances a grid by all the time it owes', () => {
    const { manager, grids } = setup()
    const queue = manager.deferredQueue()
    queue.attach?.()
    const spies = grids.map((grid) => vi.spyOn(grid, 'update'))
    manager.update(0.016)
    manager.update(0.016)
    expect(spies.every((spy) => spy.mock.calls.length === 0)).toBe(true)
    expect(queue.pending()).toBe(2)
    expect(queue.run(0, () => 1)).toBe(1)
    expect(spies.map((spy) => spy.mock.calls.length).sort()).toEqual([0, 1])
    queue.flush()
    for (const spy of spies) expect(spy.mock.calls[0]?.[0]).toBeCloseTo(0.032, 9)
    manager.update(0.016)
    expect(manager.stats().starved).toBe(0)
  })
})
