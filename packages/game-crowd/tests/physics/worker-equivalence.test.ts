/**
 * Equivalence test: the worker path (`'auto'` with factory or `'on'` with shared transport)
 * must produce exactly the same state as the inline reference transport (`'on'` with inline transport)
 * over a meaningful number of steps, for the same scene and seed.
 *
 * When no worker factory is available, `'auto'` falls back to the in-thread path (`'off'`)
 * byte for byte, preserving backwards compatibility.
 */
import { Worker } from 'node:worker_threads'

import { describe, expect, it } from 'vitest'

import { CELL, STATE, createCrowd, createNavGrid } from '../../src'
import type { CrowdPhysicsOptions, PhysicsWorkerFactory, PhysicsWorkerHandle } from '../../src'
import { CROWD_PHYSICS_DEFAULTS } from '../../src/physics/options'
import { makeTarget, packWithBalance, physicsOptions } from './scenes'
import { hashCrowdState } from './state-hash'

const WORKER_FILE = new URL('../fixtures/node-physics-worker.mjs', import.meta.url)

const nodeWorkerFactory: PhysicsWorkerFactory = (): PhysicsWorkerHandle => {
  const worker = new Worker(WORKER_FILE)
  return { postMessage: (message, transfer) => worker.postMessage(message, transfer), onMessage: (listener) => void worker.on('message', listener), terminate: () => void worker.terminate() }
}

/** Build a wall scene of `count` agents, run `steps` fixed steps, return the state hash. */
const runScene = (count: number, steps: number, physics: CrowdPhysicsOptions): string => {
  const grid = createNavGrid({ size: 128, border: true })
  grid.fillRect(-15, -0.5, 15, 0.5, CELL.SOLID, 3)
  const { target } = makeTarget(0, 4)
  const crowd = createCrowd({ pack: packWithBalance(), seed: 21, grid, capacity: Math.max(count + 200, 1200), target, flow: { cellsPerStep: 20000, clock: () => 0 }, physics })
  for (let k = 0; k < count; k++) {
    const row = Math.floor(k / 40)
    const i = crowd.spawn(((k % 40) - 20 + (row % 2) * 0.5) * 0.6, -1.5 - row * 0.55, k % 7 === 0 ? 3 : 0)
    crowd.store.state[i] = STATE.CHASE
  }
  for (let step = 0; step < steps; step++) crowd.update(1 / 60, { flowTarget: [0, -230], bandCentre: [0, -12] })
  const hash = hashCrowdState(crowd)
  crowd.dispose()
  return hash
}

describe('worker equivalence: worker path produces the same state as inline reference', () => {
  const STEPS = 300
  const COUNT = 600

  it('shared transport with node worker produces the exact same hash as inline transport over 300 steps with 600 agents', () => {
    const inline = runScene(COUNT, STEPS, physicsOptions({ worker: 'on', workerTransport: 'inline' }))
    const shared = runScene(COUNT, STEPS, physicsOptions({ worker: 'on', workerTransport: 'shared', workerFactory: nodeWorkerFactory }))
    expect(shared).toBe(inline)
  })

  it('a second run of shared worker matches the first run byte for byte (determinism)', () => {
    const shared1 = runScene(COUNT, STEPS, physicsOptions({ worker: 'on', workerTransport: 'shared', workerFactory: nodeWorkerFactory }))
    const shared2 = runScene(COUNT, STEPS, physicsOptions({ worker: 'on', workerTransport: 'shared', workerFactory: nodeWorkerFactory }))
    expect(shared2).toBe(shared1)
  })

  it('auto without factory (default): same hash as off over 300 steps with 600 agents', () => {
    const off = runScene(COUNT, STEPS, physicsOptions({ worker: 'off' }))
    const auto = runScene(COUNT, STEPS, physicsOptions({ worker: 'auto' }))
    expect(auto).toBe(off)
  })

  it('auto with factory: same hash as the shared worker over 300 steps with 600 agents', () => {
    const shared = runScene(COUNT, STEPS, physicsOptions({ worker: 'on', workerTransport: 'shared', workerFactory: nodeWorkerFactory }))
    const auto = runScene(COUNT, STEPS, physicsOptions({ worker: 'auto', workerFactory: nodeWorkerFactory }))
    expect(auto).toBe(shared)
  })

  it('the default (no worker option set) matches off over 300 steps, proving the fallback', () => {
    const off = runScene(COUNT, STEPS, physicsOptions({ worker: 'off' }))
    // CROWD_PHYSICS_DEFAULTS does not include `worker`, so the resolved default ('auto') applies.
    // In Node without a workerFactory, 'auto' falls back to inline — same as 'off'.
    const defaultPhysics = runScene(COUNT, STEPS, physicsOptions())
    expect(defaultPhysics).toBe(off)
  })

  it('with latency 2: inline and shared agree, and differ from latency 1', () => {
    const inlineL2 = runScene(COUNT, STEPS, physicsOptions({ worker: 'on', workerTransport: 'inline', workerLatency: 2 }))
    const sharedL2 = runScene(COUNT, STEPS, physicsOptions({ worker: 'on', workerTransport: 'shared', workerFactory: nodeWorkerFactory, workerLatency: 2 }))
    const inlineL1 = runScene(COUNT, STEPS, physicsOptions({ worker: 'on', workerTransport: 'inline', workerLatency: 1 }))
    expect(sharedL2).toBe(inlineL2)
    expect(inlineL2).not.toBe(inlineL1)
  })
})
