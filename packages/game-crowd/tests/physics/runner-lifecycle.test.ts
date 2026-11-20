import { describe, expect, it } from 'vitest'

import type { ResidentHandle, ResidentKind, TaskHandle, WorkerCoordinator } from '@adatechnology/game-contracts'

import { createCoordinatorRunner } from '../../src'
import { frameBytes } from '../../src/physics/offload/frame'
import type { KernelSetup } from '../../src/physics/offload/kernel'

type Fake = { readonly coordinator: WorkerCoordinator; readonly disposed: boolean[] }

/** A coordinator whose residents answer every step with `collect`, and record whether they were disposed. */
function fakeCoordinator(collect: () => ArrayBuffer): Fake {
  const disposed: boolean[] = []
  const coordinator = {
    resident: <Init, Step, Result>(_kind: ResidentKind<Init, Step, Result>, _init: Init): ResidentHandle<Step, Result> => {
      const index = disposed.push(false) - 1
      const handle = { dueFrame: 0, collect } as unknown as TaskHandle<Result>
      return { id: 'fake', step: () => handle, dispose: () => void (disposed[index] = true) }
    },
  } as unknown as WorkerCoordinator
  return { coordinator, disposed }
}

const SETUP = {} as KernelSetup
const SHAPE = { capacity: 4, cells: 4 }

describe('the coordinator runner with a changing grid', () => {
  it('disposes the retired resident even when collecting its last step throws', () => {
    const fake = fakeCoordinator(() => {
      throw new Error('kernel failed')
    })
    const grid = { occ: new Uint8Array(4), version: 0 }
    const runner = createCoordinatorRunner(SETUP, SHAPE, fake.coordinator, 2, grid)
    runner.submit()
    grid.version = 1
    runner.submit()
    expect(fake.disposed).toEqual([false, false])
    expect(() => runner.settle()).toThrow('kernel failed')
    expect(fake.disposed).toEqual([true, false])
    expect(runner.inFlight).toBe(1)
  })

  it('keeps a retired resident until its last step is taken back, then disposes it', () => {
    const fake = fakeCoordinator(() => new ArrayBuffer(frameBytes({ capacity: SHAPE.capacity, cells: 0 })))
    const grid = { occ: new Uint8Array(4), version: 0 }
    const runner = createCoordinatorRunner(SETUP, SHAPE, fake.coordinator, 2, grid)
    runner.submit()
    grid.version = 1
    runner.submit()
    expect(fake.disposed).toEqual([false, false])
    runner.settle()
    expect(fake.disposed).toEqual([true, false])
    runner.dispose()
    expect(fake.disposed).toEqual([true, true])
  })
})
