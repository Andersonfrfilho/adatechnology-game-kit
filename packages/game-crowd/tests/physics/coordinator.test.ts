import { describe, expect, it } from 'vitest'

import { createWorkerCoordinator, inThreadSpawn } from '@adatechnology/game-workers'
import { nodeSpawn } from '@adatechnology/game-workers/node'

import { CELL, STATE, createCrowd, createNavGrid, crowdPhysicsKind } from '../../src'
import { makeTarget, packWithBalance, physicsOptions } from './scenes'
import { hashCrowdState } from './state-hash'

const WORKER_FILE = new URL('../fixtures/node-coordinator-worker.mjs', import.meta.url)
const STEPS = 300

/** The wall of the offload tests: 600 agents pressing into a wall, stepped `steps` times; `between` runs between steps (a worker answers then). */
async function runWall(physics: ReturnType<typeof physicsOptions>, between?: () => Promise<void>): Promise<string> {
  const grid = createNavGrid({ size: 128, border: true })
  grid.fillRect(-15, -0.5, 15, 0.5, CELL.SOLID, 3)
  const { target } = makeTarget(0, 4)
  const crowd = createCrowd({ pack: packWithBalance(), seed: 21, grid, capacity: 1200, target, flow: { cellsPerStep: 20000, clock: () => 0 }, physics })
  for (let k = 0; k < 600; k++) {
    const row = Math.floor(k / 40)
    const i = crowd.spawn(((k % 40) - 20 + (row % 2) * 0.5) * 0.6, -1.5 - row * 0.55, k % 7 === 0 ? 3 : 0)
    crowd.store.state[i] = STATE.CHASE
  }
  const context = { target, bandCentre: [0, -12] as [number, number] }
  for (let step = 0; step < STEPS; step++) {
    crowd.update(1 / 60, context)
    if (between) await between()
  }
  crowd.dispose()
  return hashCrowdState(crowd)
}

const yieldToWorkers = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 5))

describe('the crowd physics through the worker coordinator', () => {
  it('the same state byte for byte as the inline protocol: no worker, a worker on time, a worker always late', async () => {
    const inline = await runWall(physicsOptions({ worker: 'on', workerTransport: 'inline' }))

    const none = createWorkerCoordinator()
    expect(await runWall(physicsOptions({ workers: none }))).toBe(inline)
    expect(none.stats().kinds[0]).toMatchObject({ id: 'crowd.physics', onTime: 0 })

    const onTime = createWorkerCoordinator({ spawn: inThreadSpawn([crowdPhysicsKind]), workers: 1 })
    expect(await runWall(physicsOptions({ workers: onTime }), yieldToWorkers)).toBe(inline)
    const stats = onTime.stats().kinds.find((k) => k.id === 'crowd.physics')!
    // most steps come back in time (a loaded machine delays a few timers: those fall back here, with the same bytes)
    expect(stats.onTime).toBeGreaterThan(STEPS * 0.5)
    onTime.dispose()

    // the event loop never runs between steps: every answer is late and the main thread computes every step
    const late = createWorkerCoordinator({ spawn: inThreadSpawn([crowdPhysicsKind]), workers: 1 })
    expect(await runWall(physicsOptions({ workers: late }))).toBe(inline)
    expect(late.stats().kinds.find((k) => k.id === 'crowd.physics')!.onTime).toBe(0)
    late.dispose()
  }, 60_000)

  it('a worker_threads worker gives the same state, with two steps of latency too', async () => {
    for (const latency of [1, 2] as const) {
      const inline = await runWall(physicsOptions({ worker: 'on', workerTransport: 'inline', workerLatency: latency }))
      const workers = createWorkerCoordinator({ spawn: nodeSpawn(WORKER_FILE), workers: 1 })
      await workers.warm([crowdPhysicsKind])
      const real = await runWall(physicsOptions({ workers, workerLatency: latency }), () => new Promise((resolve) => setTimeout(resolve, 4)))
      expect(real).toBe(inline)
      expect(workers.stats().kinds.find((k) => k.id === 'crowd.physics')!.onTime).toBeGreaterThan(0)
      workers.dispose()
    }
  }, 120_000)
})
