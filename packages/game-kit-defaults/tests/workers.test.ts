import { describe, expect, it } from 'vitest'

import { WORKER_KIND_ID, inThreadSpawn } from '@adatechnology/game-workers'

import { KIT_WORKER_KINDS, createKitWorkers } from '../src'

describe('the kit worker coordinator (CLAUDE.md §14)', () => {
  it('knows every kit kind, on by default and set by hand through the same options', async () => {
    expect(KIT_WORKER_KINDS.map((k) => k.id).sort()).toEqual([WORKER_KIND_ID.CROWD_PHYSICS, WORKER_KIND_ID.GROUND_TILES, WORKER_KIND_ID.STATIC_COLLIDERS, WORKER_KIND_ID.SHAPES_GENERATE].sort())
    const workers = createKitWorkers({ spawn: inThreadSpawn(KIT_WORKER_KINDS), cores: 8 })
    // the automatic count: 8 cores, one kept for the main thread
    expect(workers.plan.total).toBe(7)
    await workers.warm(KIT_WORKER_KINDS)
    workers.dispose()

    const byHand = createKitWorkers({ spawn: inThreadSpawn(KIT_WORKER_KINDS), workers: 3, lanes: { sim: { workers: 2 } }, kinds: { [WORKER_KIND_ID.GROUND_TILES]: { latencyFrames: 3 } } })
    expect(byHand.plan.lanes).toMatchObject({ sim: 2 })
    expect(byHand.scheduleOf(KIT_WORKER_KINDS.find((k) => k.id === WORKER_KIND_ID.GROUND_TILES)!).latencyFrames).toBe(3)
    byHand.dispose()
  })

  it('off with spawn null or workers 0, and with no Worker in the runtime (Node): every job on the main thread', () => {
    expect(createKitWorkers({ spawn: null }).plan.total).toBe(0)
    expect(createKitWorkers({ spawn: inThreadSpawn(KIT_WORKER_KINDS), workers: 0 }).plan.total).toBe(0)
    expect(createKitWorkers().stats().workers).toBe(0)
  })
})
