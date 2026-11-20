import { describe, expect, it } from 'vitest'

import type { ResidentKind, WorkerCoordinator } from '@adatechnology/game-contracts'
import { createWorkerCoordinator, inThreadSpawn } from '@adatechnology/game-workers'
import { nodeSpawn } from '@adatechnology/game-workers/node'

import { CELL, STATE, createCrowd, createNavGrid, crowdPhysicsKind } from '../../src'
import { frameBytes } from '../../src/physics/offload/frame'
import { makeTarget, packWithBalance, physicsOptions } from './scenes'
import { hashCrowdState } from './state-hash'

const WORKER_FILE = new URL('../fixtures/node-coordinator-worker.mjs', import.meta.url)
const STEPS = 300

/** The wall of the offload tests: 600 agents pressing into a wall, stepped `steps` times; `between` runs between steps (a worker answers then). */
async function runWall(physics: ReturnType<typeof physicsOptions>, between?: () => Promise<void>, edit?: (grid: ReturnType<typeof createNavGrid>, step: number) => void): Promise<string> {
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
    edit?.(grid, step)
    crowd.update(1 / 60, context)
    if (between) await between()
  }
  crowd.dispose()
  return hashCrowdState(crowd)
}

/** A coordinator that records the byte length of every step it is handed, and otherwise is the real one. */
function spyOnSteps(inner: WorkerCoordinator, sizes: number[]): WorkerCoordinator {
  return {
    ...inner,
    resident: <Init, Step, Result>(kind: ResidentKind<Init, Step, Result>, init: Init) => {
      const resident = inner.resident(kind, init)
      return { ...resident, step: (input: Step, at?: { readonly frame?: number; readonly latencyFrames?: number }) => (sizes.push((input as unknown as ArrayBuffer).byteLength), resident.step(input, at)) }
    },
  } as WorkerCoordinator
}
const openGap = (grid: ReturnType<typeof createNavGrid>, step: number): void => {
  if (step === 100) grid.fillRect(-2, -0.5, 2, 0.5, CELL.FREE, 0)
}

type Grid = ReturnType<typeof createNavGrid>
const editsOf = (...rects: readonly (readonly [number, number, number, number, number, number, number])[]) => (grid: Grid, step: number): void => {
  for (const [at, x0, z0, x1, z1, kind, height] of rects) if (step === at) grid.fillRect(x0, z0, x1, z1, kind, height)
}
// two edits in consecutive steps; two edits between the same two steps; an edit that changes only the heights of the wall
const EDIT_SCENARIOS = {
  consecutive: editsOf([100, -2, -0.5, 0, 0.5, CELL.FREE, 0], [101, 0, -0.5, 2, 0.5, CELL.FREE, 0]),
  sameGap: editsOf([100, -2, -0.5, 0, 0.5, CELL.FREE, 0], [100, 8, -0.5, 10, 0.5, CELL.FREE, 0]),
  heightOnly: editsOf([100, -15, -0.5, 15, 0.5, CELL.SOLID, 1]),
} as const

/** The real coordinator, counting the residents opened and the ones disposed. */
function countResidents(inner: WorkerCoordinator, counts: { opened: number; disposed: number }): WorkerCoordinator {
  return {
    ...inner,
    resident: <Init, Step, Result>(kind: ResidentKind<Init, Step, Result>, init: Init) => {
      const resident = inner.resident(kind, init)
      counts.opened++
      let isDisposed = false
      return {
        ...resident,
        dispose: () => {
          if (!isDisposed) counts.disposed++
          isDisposed = true
          resident.dispose()
        },
      }
    },
  } as WorkerCoordinator
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

  it('hands the worker the agents of the step, not the whole grid, and the same bytes come out of it', async () => {
    const sizes: number[] = []
    const real = createWorkerCoordinator()
    await runWall(physicsOptions({ workers: spyOnSteps(real, sizes) }))
    const cells = createNavGrid({ size: 128, border: true }).occ.length
    expect(sizes).toHaveLength(STEPS)
    expect(Math.max(...sizes)).toBeLessThan(frameBytes({ capacity: 1200, cells }))
    expect(Math.max(...sizes)).toBe(frameBytes({ capacity: 1200, cells: 0 }))
  }, 60_000)

  it('a wall opened in the middle of the run gives the same state as the inline protocol, on time or late', async () => {
    const inline = await runWall(physicsOptions({ worker: 'on', workerTransport: 'inline' }), undefined, openGap)
    const closed = await runWall(physicsOptions({ worker: 'on', workerTransport: 'inline' }))
    expect(inline).not.toBe(closed)

    const onTime = createWorkerCoordinator({ spawn: inThreadSpawn([crowdPhysicsKind]), workers: 1 })
    expect(await runWall(physicsOptions({ workers: onTime }), yieldToWorkers, openGap)).toBe(inline)
    onTime.dispose()

    const late = createWorkerCoordinator({ spawn: inThreadSpawn([crowdPhysicsKind]), workers: 1 })
    expect(await runWall(physicsOptions({ workers: late }), undefined, openGap)).toBe(inline)
    late.dispose()
  }, 60_000)

  it('several edits, in consecutive steps, between two steps or only of the heights, give the inline state on time or late', async () => {
    for (const edit of Object.values(EDIT_SCENARIOS)) {
      const inline = await runWall(physicsOptions({ worker: 'on', workerTransport: 'inline' }), undefined, edit)

      const onTime = createWorkerCoordinator({ spawn: inThreadSpawn([crowdPhysicsKind]), workers: 1 })
      expect(await runWall(physicsOptions({ workers: onTime }), yieldToWorkers, edit)).toBe(inline)
      onTime.dispose()

      const late = createWorkerCoordinator({ spawn: inThreadSpawn([crowdPhysicsKind]), workers: 1 })
      expect(await runWall(physicsOptions({ workers: late }), undefined, edit)).toBe(inline)
      late.dispose()
    }
    const inlineBase = await runWall(physicsOptions({ worker: 'on', workerTransport: 'inline' }))
    expect(await runWall(physicsOptions({ worker: 'on', workerTransport: 'inline' }), undefined, EDIT_SCENARIOS.consecutive)).not.toBe(inlineBase)
  }, 120_000)

  it('keeps at most the current resident and the ones in flight across many grid changes, and none after dispose', async () => {
    const counts = { opened: 0, disposed: 0 }
    const slots = 2
    const workers = createWorkerCoordinator({ spawn: inThreadSpawn([crowdPhysicsKind]), workers: 1 })
    const coordinator = countResidents(workers, counts)
    let peak = 0
    // a write every 10 steps; the first one rewrites the solid wall as solid, so 28 of the 29 change a cell
    const edit = (grid: Grid, step: number): void => {
      if (step > 0 && step % 10 === 0) grid.fillRect(-2, -0.5, 2, 0.5, step % 20 === 0 ? CELL.FREE : CELL.SOLID, 3)
      peak = Math.max(peak, counts.opened - counts.disposed)
    }
    await runWall(physicsOptions({ workers: coordinator, workerLatency: slots }), yieldToWorkers, edit)
    expect(counts.opened).toBe(29)
    expect(peak).toBeLessThanOrEqual(slots + 1)
    expect(counts.disposed).toBe(counts.opened)
    workers.dispose()
  }, 60_000)

  it('a worker_threads worker gives the same state, with two steps of latency too', async () => {
    for (const latency of [1, 2] as const) {
      const inline = await runWall(physicsOptions({ worker: 'on', workerTransport: 'inline', workerLatency: latency }))
      const workers = createWorkerCoordinator({ spawn: nodeSpawn(WORKER_FILE), workers: 1 })
      await workers.warm([crowdPhysicsKind])
      const real = await runWall(physicsOptions({ workers, workerLatency: latency }), () => new Promise((resolve) => setTimeout(resolve, 4)))
      expect(real).toBe(inline)
      const inlineEdited = await runWall(physicsOptions({ worker: 'on', workerTransport: 'inline', workerLatency: latency }), undefined, openGap)
      expect(await runWall(physicsOptions({ workers, workerLatency: latency }), () => new Promise((resolve) => setTimeout(resolve, 4)), openGap)).toBe(inlineEdited)
      expect(workers.stats().kinds.find((k) => k.id === 'crowd.physics')!.onTime).toBeGreaterThan(0)
      workers.dispose()
    }
  }, 120_000)

  it('never spawns a Worker directly without physics.workers or physics.workerFactory (CLAUDE.md §14)', () => {
    const scope = globalThis as { Worker?: unknown }
    const previous = scope.Worker
    let spawned = 0
    scope.Worker = class {
      constructor() {
        spawned++
      }
    }
    try {
      const grid = createNavGrid({ size: 32, border: true })
      const { target } = makeTarget(0, 4)
      const crowd = createCrowd({ pack: packWithBalance(), seed: 21, grid, capacity: 32, target, physics: physicsOptions({ worker: 'auto' }) })
      crowd.spawn(0, -1, 0)
      crowd.update(1 / 60, { target, bandCentre: [0, 0] })
      crowd.dispose()
      expect(spawned).toBe(0)

      expect(() => createCrowd({ pack: packWithBalance(), seed: 21, grid, capacity: 32, target, physics: physicsOptions({ worker: 'on' }) })).toThrow(/physics\.workers/)
      expect(spawned).toBe(0)
    } finally {
      if (previous === undefined) delete scope.Worker
      else scope.Worker = previous
    }
  })
})
