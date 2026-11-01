import { Worker } from 'node:worker_threads'

import { describe, expect, it } from 'vitest'

import { CELL, STATE, createCrowd, createNavGrid } from '../../src'
import type { PhysicsWorkerFactory, PhysicsWorkerHandle } from '../../src'
import { createFrame, frameBytes } from '../../src/physics/offload/frame'
import { writeSnapshot } from '../../src/physics/offload/offload'
import { createInlineRunner, createSharedRunner, createTransferRunner } from '../../src/physics/offload/runner'
import type { StepRunner } from '../../src/physics/offload/runner'
import type { KernelSetup } from '../../src/physics/offload/kernel'
import { CONTACT_DEFAULTS, PRESSURE_DEFAULTS } from '../../src/physics/options'
import { makeTarget, packWithBalance, physicsOptions } from './scenes'
import { hashCrowdState } from './state-hash'

const WORKER_FILE = new URL('../fixtures/node-physics-worker.mjs', import.meta.url)

const nodeWorkerFactory: PhysicsWorkerFactory = (): PhysicsWorkerHandle => {
  const worker = new Worker(WORKER_FILE)
  return { postMessage: (message, transfer) => worker.postMessage(message, transfer), onMessage: (listener) => void worker.on('message', listener), terminate: () => void worker.terminate() }
}

const createWall = (count: number, physics: ReturnType<typeof physicsOptions>) => {
  const grid = createNavGrid({ size: 128, border: true })
  grid.fillRect(-15, -0.5, 15, 0.5, CELL.SOLID, 3)
  const { target } = makeTarget(0, 4)
  const crowd = createCrowd({ pack: packWithBalance(), seed: 21, grid, capacity: 1200, target, flow: { cellsPerStep: 20000, clock: () => 0 }, physics })
  for (let k = 0; k < count; k++) {
    const row = Math.floor(k / 40)
    const i = crowd.spawn(((k % 40) - 20 + (row % 2) * 0.5) * 0.6, -1.5 - row * 0.55, k % 7 === 0 ? 3 : 0)
    crowd.store.state[i] = STATE.CHASE
  }
  return { crowd, grid, context: { target, bandCentre: [0, -12] as [number, number] } }
}

const runWall = (steps: number, physics: ReturnType<typeof physicsOptions>): string => {
  const scene = createWall(600, physics)
  for (let step = 0; step < steps; step++) scene.crowd.update(1 / 60, scene.context)
  scene.crowd.dispose()
  return hashCrowdState(scene.crowd)
}

const kernelSetup = (capacity: number, gridSize: number): KernelSetup => ({ capacity, gridSize, gridCell: 0.5, contact: CONTACT_DEFAULTS, pressure: PRESSURE_DEFAULTS, driveForceOfType: Array.from({ length: 16 }, () => 250) })

const outputsOf = (runner: StepRunner, frame = runner.frame()!): string => {
  const parts: number[] = []
  for (const key of ['deltaX', 'deltaZ', 'deltaPushX', 'deltaPushZ', 'deltaVx', 'deltaVz', 'field', 'shove', 'doorLoad'] as const) parts.push(...new Uint8Array(frame.f32[key].buffer, frame.f32[key].byteOffset, frame.f32[key].byteLength))
  parts.push(...new Uint8Array(frame.header.buffer, frame.header.byteOffset, 8 * 16), ...new Uint8Array(frame.doorCell.buffer, frame.doorCell.byteOffset, frame.doorCell.byteLength))
  return parts.join(',')
}

describe('the physics step as a pure function of one frame', () => {
  const scene = createWall(600, physicsOptions())
  for (let step = 0; step < 150; step++) scene.crowd.update(1 / 60, scene.context)
  const shape = { capacity: 1200, cells: scene.grid.occ.length }
  const setup = kernelSetup(1200, scene.grid.size)
  const fill = (runner: StepRunner): void => writeSnapshot(runner.frame()!, { store: scene.crowd.store, grid: scene.grid }, 1 / 60, { x: 0, z: 4 })

  it('a worker over a shared buffer writes the same bytes as the same step on the main thread', () => {
    const inline = createInlineRunner(setup, shape)
    const shared = createSharedRunner(setup, shape, nodeWorkerFactory)
    try {
      fill(inline)
      fill(shared)
      inline.submit()
      shared.submit()
      const fromInline = inline.settle()
      const fromShared = shared.settle()
      expect(fromInline).not.toBeNull()
      expect(fromShared).not.toBeNull()
      expect(outputsOf(shared, fromShared!)).toBe(outputsOf(inline, fromInline!))
      expect(fromShared!.header[5]).toBeGreaterThan(100)
    } finally {
      shared.dispose()
    }
  })

  it('a worker with the buffer transferred by postMessage writes the same bytes too, and several steps in a row stay equal', async () => {
    const inline = createInlineRunner(setup, shape)
    const transfer = createTransferRunner(setup, shape, nodeWorkerFactory)
    try {
      for (let round = 0; round < 3; round++) {
        fill(inline)
        fill(transfer)
        inline.submit()
        transfer.submit()
        expect(transfer.frame()).toBeNull()
        const fromInline = inline.settle()!
        let fromTransfer = transfer.settle()
        for (let wait = 0; wait < 500 && !fromTransfer; wait++) {
          await new Promise((resolve) => setTimeout(resolve, 5))
          fromTransfer = transfer.settle()
        }
        expect(fromTransfer).not.toBeNull()
        expect(outputsOf(transfer, fromTransfer!)).toBe(outputsOf(inline, fromInline))
      }
    } finally {
      transfer.dispose()
    }
  })

  it('the frame layout fits its buffer', () => {
    expect(() => createFrame(new ArrayBuffer(frameBytes(shape)), shape)).not.toThrow()
  })
})

describe('the crowd with the physics in a worker', () => {
  const STEPS = 300

  it('shared worker, inline protocol and a second shared run give the same state byte for byte', () => {
    const shared = runWall(STEPS, physicsOptions({ worker: 'on', workerTransport: 'shared', workerFactory: nodeWorkerFactory }))
    const sharedAgain = runWall(STEPS, physicsOptions({ worker: 'on', workerTransport: 'shared', workerFactory: nodeWorkerFactory }))
    const inline = runWall(STEPS, physicsOptions({ worker: 'on', workerTransport: 'inline' }))
    expect(sharedAgain).toBe(shared)
    expect(inline).toBe(shared)
  })

  it('the horde still presses, falls and measures contacts one step behind', () => {
    const scene = createWall(600, physicsOptions({ worker: 'on', workerTransport: 'inline' }))
    for (let step = 0; step < STEPS; step++) scene.crowd.update(1 / 60, scene.context)
    const { physics } = scene.crowd.stats
    expect(physics.contacts).toBeGreaterThan(100)
    expect(physics.fieldMax).toBeGreaterThan(500)
    expect(physics.meanOverlap).toBeLessThan(0.05)
  })

  it('with two steps of latency the shared worker and the inline protocol still agree byte for byte, and differ from one step of latency', () => {
    const shared = runWall(STEPS, physicsOptions({ worker: 'on', workerTransport: 'shared', workerFactory: nodeWorkerFactory, workerLatency: 2 }))
    const inline = runWall(STEPS, physicsOptions({ worker: 'on', workerTransport: 'inline', workerLatency: 2 }))
    expect(shared).toBe(inline)
    expect(inline).not.toBe(runWall(STEPS, physicsOptions({ worker: 'on', workerTransport: 'inline', workerLatency: 1 })))
  })

  it("'off' is the in-thread path and 'auto' with no worker to make falls back to it", () => {
    const off = runWall(STEPS, physicsOptions({ worker: 'off' }))
    expect(runWall(STEPS, physicsOptions())).toBe(off)
    expect(runWall(STEPS, physicsOptions({ worker: 'auto' }))).toBe(off)
  })

  it("'on' with no worker to make is an error, not a silent in-thread run", () => {
    expect(() => createWall(10, physicsOptions({ worker: 'on' }))).toThrow(/no Worker/)
  })

  it('an agent removed while the result is in flight keeps the result of its own body', () => {
    const grid = createNavGrid({ size: 512, border: true })
    grid.fillRect(-60, -21, 60, -20, CELL.SOLID, 3)
    const crowd = createCrowd({ pack: packWithBalance(), seed: 3, grid, capacity: 20, flow: { cellsPerStep: 20000, clock: () => 0 }, physics: physicsOptions({ personality: false, worker: 'on', workerTransport: 'inline' }) })
    const context = { flowTarget: [0, -230] as [number, number], bandCentre: [0, -12] as [number, number] }
    const free = [crowd.spawn(30, -10, 0), crowd.spawn(-30, -10, 0)]
    const pressed = crowd.spawn(0, -19.6, 0)
    for (const i of [...free, pressed]) crowd.store.state[i] = STATE.CHASE
    for (let step = 0; step < 30; step++) crowd.update(1 / 60, context)
    const field = crowd.store.field[pressed]!
    expect(field).toBeGreaterThan(100)
    expect(crowd.store.field[free[0]!]).toBe(0)
    crowd.remove(free[0]!)
    expect(crowd.store.field[free[0]!]).toBe(field)
    crowd.update(1 / 60, context)
    expect(crowd.store.field[free[0]!]).toBeGreaterThan(field * 0.9)
    expect(crowd.store.field[1]).toBe(0)
  })
})
