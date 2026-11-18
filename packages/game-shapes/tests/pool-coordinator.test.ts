import { afterEach, describe, expect, it } from 'vitest'

import { checkTaskKind, createWorkerCoordinator, firstDifference, inThreadSpawn } from '@adatechnology/game-workers'
import { nodeSpawn } from '@adatechnology/game-workers/node'

import { createShapePool, generate, registerGenerator, shapesGenerateKind, unregisterGenerator } from '../src'
import type { ShapeGenerateJob, ShapeSchema } from '../src'
// @ts-expect-error plain JS fixture shared with the worker script
import { rocks } from './fixtures/rocks.mjs'

const shape = (n: number): ShapeSchema => ({
  version: 1,
  name: `shape-${n}`,
  root: {
    kind: 'group',
    children: [
      { kind: 'box', size: [1, 0.5 + n * 0.01, 0.4], material: 'wood' },
      { kind: 'cylinder', radiusTop: 0.05, radiusBottom: 0.05, height: 0.8, radialSegments: 12, position: [0.3, 0.4, 0], material: 'metal' },
      { kind: 'custom', generator: 'test.rocks', params: { count: 3 } },
    ],
  },
  lod: [{ distance: 10, detail: 0.5 }],
})

describe('shapes.generate through the worker coordinator (CLAUDE.md §14)', () => {
  afterEach(() => unregisterGenerator('test.rocks'))

  it('gives the same buffers, normals included, on the main thread, in the in-thread worker and in worker_threads', async () => {
    registerGenerator('test.rocks', rocks)
    const samples: ShapeGenerateJob[] = [{ schema: shape(1) }, { schema: shape(2), options: { seed: 7 } }, { schema: shape(3), options: { colors: 'srgb', indexed: false } }]
    const report = await checkTaskKind(shapesGenerateKind, samples, [nodeSpawn(new URL('./fixtures/coordinator-worker.mjs', import.meta.url))])
    expect(report.problems).toEqual([])
  }, 60_000)

  it('createShapePool({ workers }) hands its jobs to the coordinator, shares a key in flight and keeps the legacy pool off', async () => {
    registerGenerator('test.rocks', rocks)
    const workers = createWorkerCoordinator({ spawn: inThreadSpawn([shapesGenerateKind]), workers: 2 })
    const pool = createShapePool({ workers, spawn: () => { throw new Error('the legacy pool must not spawn with a coordinator') }, size: 2 })
    const list = [shape(1), shape(2), shape(1), shape(4)]
    const out = await pool.generateMany(list)
    for (let i = 0; i < list.length; i++) expect(firstDifference(out[i], generate(list[i]!))).toBeNull()
    expect(out[0]!.levels[0]!.batches[0]!.normals.length).toBeGreaterThan(0)
    expect(pool.stats()).toMatchObject({ workers: 2, jobs: 4, shared: 1, inThread: 0 })
    expect(workers.stats().kinds.find((k) => k.id === 'shapes.generate')).toMatchObject({ submitted: 3, answered: 3, fallback: 0 })
    workers.dispose()
  })

  it('a job the workers cannot make (a generator only this thread knows) is made here, with the same bytes', async () => {
    registerGenerator('test.only-here', rocks)
    const workers = createWorkerCoordinator({ spawn: nodeSpawn(new URL('./fixtures/coordinator-worker.mjs', import.meta.url)), workers: 1 })
    const pool = createShapePool({ workers })
    const schema: ShapeSchema = { version: 1, root: { kind: 'custom', generator: 'test.only-here', params: { count: 2 } } }
    const made = await pool.generate(schema)
    expect(firstDifference(made, generate(schema))).toBeNull()
    expect(workers.stats().kinds.find((k) => k.id === 'shapes.generate')).toMatchObject({ failed: 1, fallback: 1 })
    workers.dispose()
    unregisterGenerator('test.only-here')
  }, 60_000)
})
