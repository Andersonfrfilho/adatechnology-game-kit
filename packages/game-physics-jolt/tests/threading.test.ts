import { describe, expect, it } from 'vitest'

import { JOLT_THREADING_ERROR, JoltThreadingError, SINGLE_THREAD, createJoltEngine, resolveJoltThreading } from '../src/index'

const codeOf = (run: () => unknown): string | undefined => {
  try {
    run()
  } catch (error) {
    return error instanceof JoltThreadingError ? error.code : 'other'
  }
  return undefined
}

describe('jolt threading options', () => {
  it('defaults to the single-threaded build with the JS contact listener', () => {
    expect(resolveJoltThreading({}, false)).toEqual(SINGLE_THREAD)
  })

  it('refuses worker threads with JS contact callbacks: Jolt would call the listener from a worker, where it does not exist', () => {
    expect(codeOf(() => resolveJoltThreading({ build: 'multithread', workerThreads: 2 }, true))).toBe(JOLT_THREADING_ERROR.WORKERS_WITH_JS_CALLBACKS)
  })

  it('refuses the multithreaded build without shared memory, workers on the single build and a bad worker count', () => {
    expect(codeOf(() => resolveJoltThreading({ build: 'multithread' }, false))).toBe(JOLT_THREADING_ERROR.MULTITHREAD_NEEDS_SHARED_MEMORY)
    expect(codeOf(() => resolveJoltThreading({ workerThreads: 1, contactCallbacks: 'none' }, true))).toBe(JOLT_THREADING_ERROR.WORKERS_NEED_MULTITHREAD_BUILD)
    expect(codeOf(() => resolveJoltThreading({ build: 'multithread', workerThreads: 1.5, contactCallbacks: 'none' }, true))).toBe(JOLT_THREADING_ERROR.BAD_WORKER_COUNT)
    expect(codeOf(() => resolveJoltThreading({ build: 'multithread', workerThreads: 17, contactCallbacks: 'none' }, true))).toBe(JOLT_THREADING_ERROR.BAD_WORKER_COUNT)
  })

  it('accepts the multithreaded build on the caller thread with the JS listener, and worker threads without it', () => {
    expect(resolveJoltThreading({ build: 'multithread' }, true)).toEqual({ build: 'multithread', workerThreads: 0, contactCallbacks: 'js' })
    expect(resolveJoltThreading({ build: 'multithread', workerThreads: 4, contactCallbacks: 'none' }, true)).toEqual({ build: 'multithread', workerThreads: 4, contactCallbacks: 'none' })
  })

  it('steps a pile on the multithreaded build with job threads and no JS listener, and frees what it made', async () => {
    const engine = await createJoltEngine({ build: 'multithread', workerThreads: 2, contactCallbacks: 'none' })
    expect(engine.threading).toEqual({ build: 'multithread', workerThreads: 2, contactCallbacks: 'none' })
    const world = engine.createWorld({ fixedStep: 1 / 60 })
    world.createBody({ shape: { kind: 'box', half: [10, 0.5, 10] }, motion: 'static', position: [0, -0.5, 0], user: 0 })
    const ids = world.createBodies(Array.from({ length: 300 }, (_, i) => ({ shape: { kind: 'box' as const, half: [0.1, 0.1, 0.1] as const }, motion: 'dynamic' as const, position: [(i % 15) * 0.25, 0.2 + Math.floor(i / 15) * 0.25, 0] as const, mass: 1, user: i })))
    for (let i = 0; i < 120; i++) world.step(1 / 60)
    const pose = new Float64Array(7)
    world.readPose(ids[0] as (typeof ids)[number], pose, 0)
    // the bottom box rests on the ground: the step ran on the job threads and the contacts held
    expect(pose[1]).toBeGreaterThan(0.05)
    expect(pose[1]).toBeLessThan(0.15)
    expect(world.contacts.count).toBe(0)
    world.dispose()
  })
})
