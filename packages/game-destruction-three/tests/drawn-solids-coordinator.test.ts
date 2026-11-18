import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import type { WorkerCoordinator } from '@adatechnology/game-contracts'
import { checkTaskKind, createWorkerCoordinator, firstDifference, inThreadSpawn } from '@adatechnology/game-workers'
import { nodeSpawn } from '@adatechnology/game-workers/node'

import { drawnSolidsOf } from '../src/drawn-solids'
import type { MeasureBudget } from '../src/drawn-solids'
import type { StaticSolid } from '../src/engine-statics'
import type { HostVis, MeshVis } from '../src/internal'
import type { StaticPartJob } from '../src/static-part-job'
import { Visuals } from '../src/visual'
import { staticCollidersKind } from '../src/worker-kinds'

/**
 * What a house draws, in three meshes: six slabs joined in one mesh (a part per vertex range, as a house joins its walls), a turned and scaled beam, and a cylinder
 * (no box fits it: the triangles as drawn).
 */
const scene = (): { visuals: Visuals; parts: MeshVis[] } => {
  const geometries = Array.from({ length: 6 }, (_, i) => new THREE.BoxGeometry(1, 2, 0.2, 4, 8, 1).translate(i * 2, 1, 0))
  const position: number[] = []
  const index: number[] = []
  const ranges: Array<[number, number]> = []
  for (const g of geometries) {
    const base = position.length / 3
    position.push(...(g.getAttribute('position').array as Float32Array))
    for (const k of g.getIndex()!.array as Uint16Array) index.push(base + k)
    ranges.push([base, position.length / 3])
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  geometry.setIndex(index)
  const joined = new THREE.Mesh(geometry)
  const beam = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 0.3))
  beam.position.set(1.3, 2.4, -0.7)
  beam.rotation.set(0.1, 0.7, -0.2)
  beam.scale.set(1.2, 0.9, 1.1)
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.5, 16))
  post.position.set(-1.5, 1.25, 0.4)
  const root = new THREE.Group()
  root.add(joined, beam, post)
  root.updateMatrixWorld(true)
  const visuals = new Visuals(THREE, false, 100)
  const hosts = new Map<THREE.Mesh, HostVis>()
  const parts = ranges.map((r) => visuals.makeMeshVis(joined, 'house', r, hosts))
  parts.push(visuals.makeMeshVis(beam, 'beam', undefined, hosts), visuals.makeMeshVis(post, 'post', undefined, hosts))
  return { visuals, parts }
}

const measureAll = (visuals: Visuals, parts: readonly MeshVis[], workers?: WorkerCoordinator): { solids: StaticSolid[][]; budget: MeasureBudget } => {
  const budget: MeasureBudget = { left: 1e9, incomplete: false, ...(workers ? { workers } : {}) }
  return { solids: parts.map((mv, k) => drawnSolidsOf(THREE, visuals, mv, `p${k}`, budget)), budget }
}

/** The jobs the renderer would hand to the workers, caught by a coordinator that never answers. */
const jobsOf = (): StaticPartJob[] => {
  const { visuals, parts } = scene()
  const jobs: StaticPartJob[] = []
  const catcher = { run: (_kind: unknown, input: StaticPartJob) => (jobs.push(input), new Promise<never>(() => undefined)) } as unknown as WorkerCoordinator
  measureAll(visuals, parts, catcher)
  return jobs
}

describe('the fixed colliders through the worker coordinator (CLAUDE.md §14)', () => {
  it('destruction.static-colliders gives the same solids, byte for byte, on the main thread, in the in-thread worker and in worker_threads', async () => {
    const jobs = jobsOf()
    expect(jobs).toHaveLength(8)
    const kinds = jobs.map((job) => staticCollidersKind.run(job))
    // the cases a house has: a box held as drawn, a box turned to fit, the triangles as drawn
    expect(kinds.filter(([solid]) => solid?.mesh).length).toBeGreaterThan(0)
    expect(kinds.filter(([solid]) => solid && !solid.mesh).length).toBeGreaterThan(0)
    const report = await checkTaskKind(staticCollidersKind, jobs, [nodeSpawn(new URL('./fixtures/coordinator-worker.mjs', import.meta.url))])
    expect(report.problems).toEqual([])
  }, 60_000)

  it('the parts wait for the workers and then are the very solids measured here, each handed once', async () => {
    const here = scene()
    const expected = measureAll(here.visuals, here.parts).solids

    const workers = createWorkerCoordinator({ spawn: inThreadSpawn([staticCollidersKind]), workers: 2 })
    const { visuals, parts } = scene()
    const first = measureAll(visuals, parts, workers)
    expect(first.budget.incomplete).toBe(true)
    expect(first.solids.every((list) => list.length === 0)).toBe(true)
    // asked again before the answers: nothing is handed twice
    measureAll(visuals, parts, workers)
    await new Promise((resolve) => setTimeout(resolve, 50))
    const done = measureAll(visuals, parts, workers)
    expect(done.budget.incomplete).toBe(false)
    expect(done.budget.left).toBe(1e9)
    for (let k = 0; k < parts.length; k++) expect(firstDifference(done.solids[k], expected[k])).toBeNull()
    expect(workers.stats().kinds.find((kind) => kind.id === 'destruction.static-colliders')).toMatchObject({ submitted: 8, answered: 8, fallback: 0 })
    workers.dispose()
  })

  it('with no workers the coordinator measures here, with the same solids', async () => {
    const here = scene()
    const expected = measureAll(here.visuals, here.parts).solids
    const workers = createWorkerCoordinator({ workers: 0 })
    const { visuals, parts } = scene()
    measureAll(visuals, parts, workers)
    await new Promise((resolve) => setTimeout(resolve, 50))
    const done = measureAll(visuals, parts, workers)
    for (let k = 0; k < parts.length; k++) expect(firstDifference(done.solids[k], expected[k])).toBeNull()
    workers.dispose()
  })
})
