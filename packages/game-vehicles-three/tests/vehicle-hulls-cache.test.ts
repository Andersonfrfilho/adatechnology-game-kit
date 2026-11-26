import * as THREE from 'three'
import { afterAll, describe, expect, it } from 'vitest'

import type { WorkerCoordinator } from '@adatechnology/game-contracts'
import { checkTaskKind, createWorkerCoordinator, firstDifference } from '@adatechnology/game-workers'
import { nodeSpawn } from '@adatechnology/game-workers/node'

import { createHullPlanCache, createVehicleColliders } from '../src'
import type { VehicleColliders, VehicleHull } from '../src'
import { hullPlanKind, planHulls } from '../src/worker-kinds'
import type { HullPlanJob, HullPlanResult } from '../src/worker-kinds'
import { build } from './vehicle-colliders-support'

const MODEL = 'naked_bike'
const MAX_HULLS = 64
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const collidersOf = (id: string, options: Partial<Parameters<typeof createVehicleColliders>[3]> = {}): { colliders: VehicleColliders; dispose: () => void; vehicle: ReturnType<typeof build>['vehicle']; frame: THREE.Object3D } => {
  const { vehicle, frame, dispose } = build(id)
  const colliders = createVehicleColliders(THREE, vehicle, frame, { hulls: true, maxHulls: MAX_HULLS, ...options })
  colliders.pieces()
  return { colliders, dispose, vehicle, frame }
}

/** The job the car of the model would send to a worker, caught by a coordinator that never answers. */
const catching = (): { workers: WorkerCoordinator; jobs: HullPlanJob[]; answer: (result: HullPlanResult) => void } => {
  const jobs: HullPlanJob[] = []
  let answer: (result: HullPlanResult) => void = () => undefined
  const workers = { run: (_kind: unknown, job: HullPlanJob) => (jobs.push(job), new Promise<HullPlanResult>((resolve) => (answer = resolve))) } as unknown as WorkerCoordinator
  return { workers, jobs, answer: (result) => answer(result) }
}

/** Calls `hulls()` the way a host does, a step at a time, until `done`: the job for the worker is made over several calls. */
const drive = (colliders: VehicleColliders, done: () => boolean): void => {
  for (let step = 0; step < 400 && !done(); step++) colliders.hulls()
  expect(done()).toBe(true)
}

const bytesOf = (hulls: readonly VehicleHull[]): unknown => hulls.map((hull) => ({ id: hull.id, key: hull.key, points: hull.points }))

const real = createWorkerCoordinator({ spawn: nodeSpawn(new URL('./fixtures/hull-worker.mjs', import.meta.url)), workers: 1 })
afterAll(() => real.dispose())

describe('the division of the hulls as a task kind (CLAUDE.md §14)', () => {
  it('vehicles.hull-plan gives the same bytes on the main thread, in the in-thread worker and in worker_threads', async () => {
    const { workers, jobs } = catching()
    const { colliders, dispose } = collidersOf(MODEL, { workers })
    drive(colliders, () => jobs.length > 0)
    dispose()
    expect(jobs).toHaveLength(1)
    const small: HullPlanJob = { pieces: [{ key: 'roof#1', vertices: Float64Array.of(0, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0.5, 1.4, 0.5), indices: Uint32Array.of(0, 1, 2, 0, 2, 3, 0, 1, 4) }], solids: [{ key: 'engine', vertices: Float64Array.of(0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1), indices: Uint32Array.of(0, 1, 2, 0, 1, 3) }], maxHulls: 8 }
    expect(planHulls(jobs[0]!).leaves.length).toBeGreaterThan(1)
    expect(planHulls(jobs[0]!).solids.length).toBeGreaterThan(0)
    const report = await checkTaskKind(hullPlanKind, [small, jobs[0]!], [nodeSpawn(new URL('./fixtures/hull-worker.mjs', import.meta.url))])
    expect(report.problems).toEqual([])
  }, 120000)

  it('is a kind of the build lane that keeps waiting, with the schedule of the kit', () => {
    expect(hullPlanKind).toMatchObject({ id: 'vehicles.hull-plan', lane: 'build', late: 'keep-waiting', priority: 120 })
  })
})

describe('the first car of a model waits for its plan in a worker and keeps the boxes meanwhile', () => {
  it('hulls() answers nothing while the plan is away, pieces() still gives the boxes, and the call after the answer installs it', async () => {
    const { workers, jobs, answer } = catching()
    const { colliders, dispose } = collidersOf(MODEL, { workers })
    const boxes = colliders.pieces()
    expect(colliders.hulls()).toEqual([])
    expect(colliders.isHullPending()).toBe(true)
    drive(colliders, () => jobs.length > 0)
    expect(colliders.hulls()).toEqual([])
    expect(colliders.isHullPending()).toBe(true)
    expect(jobs).toHaveLength(1)
    expect(colliders.pieces().length).toBe(boxes.length)
    answer(planHulls(jobs[0]!))
    await sleep(0)
    const installed = colliders.hulls()
    expect(colliders.isHullPending()).toBe(false)
    const reference = collidersOf(MODEL)
    expect(firstDifference(bytesOf(installed), bytesOf(reference.colliders.hulls()))).toBeNull()
    expect(installed.length).toBeGreaterThan(0)
    dispose()
    reference.dispose()
  }, 120000)

  it('the plan made by a real worker gives the very hulls the main thread makes, byte for byte', async () => {
    await real.warm([hullPlanKind])
    const { colliders, dispose } = collidersOf(MODEL, { workers: real })
    expect(colliders.hulls()).toEqual([])
    for (let waited = 0; colliders.isHullPending() && waited < 400; waited++) {
      await sleep(25)
      if (!colliders.hulls().length) continue
    }
    const fromWorker = colliders.hulls()
    const here = collidersOf(MODEL)
    expect(firstDifference(bytesOf(fromWorker), bytesOf(here.colliders.hulls()))).toBeNull()
    expect(real.stats().kinds.find((kind) => kind.id === 'vehicles.hull-plan')).toMatchObject({ submitted: 1, fallback: 0, failed: 0 })
    dispose()
    here.dispose()
  }, 120000)

  it('two cars of the model that spawn together send one plan', async () => {
    const { workers, jobs, answer } = catching()
    const cache = createHullPlanCache()
    const first = collidersOf(MODEL, { workers, planCache: cache })
    const second = collidersOf(MODEL, { workers, planCache: cache })
    drive(first.colliders, () => jobs.length > 0)
    for (let step = 0; step < 50; step++) second.colliders.hulls()
    expect(jobs).toHaveLength(1)
    answer(planHulls(jobs[0]!))
    await sleep(0)
    const a = first.colliders.hulls()
    const b = second.colliders.hulls()
    expect(a.length).toBeGreaterThan(0)
    expect(firstDifference(bytesOf(a), bytesOf(b))).toBeNull()
    expect(cache.stats().planned).toBe(1)
    first.dispose()
    second.dispose()
    cache.dispose()
  }, 120000)
})

describe('the second car of a model is given the hulls of the first (design 10.4)', () => {
  it('is given the very hulls, with no division, the cache lets go of them on dispose, and a dent in one car does not touch the other', () => {
    const cache = createHullPlanCache()
    const first = collidersOf(MODEL, { planCache: cache })
    const made = first.colliders.hulls()
    const second = collidersOf(MODEL, { planCache: cache })
    const given = second.colliders.hulls()
    expect(cache.stats()).toMatchObject({ models: 1, planned: 1, reused: 1 })
    expect(given.length).toBe(made.length)
    expect(given.every((hull, i) => hull === made[i])).toBe(true)
    expect(second.colliders.drawnPointsOf(given[0]!).length).toBeGreaterThan(0)

    const meshes: THREE.Mesh[] = []
    ;(second.vehicle.vehicle.vehicle as THREE.Object3D).traverse((node) => {
      const candidate = node as THREE.Mesh
      if (candidate.isMesh && candidate.visible && candidate.geometry.getAttribute('position')) meshes.push(candidate)
    })
    for (const mesh of meshes) {
      const position = mesh.geometry.getAttribute('position')
      position.setX(0, position.getX(0) + 0.01)
      position.needsUpdate = true
    }
    const dented = second.colliders.hulls()
    expect(dented.map((hull) => hull.key).sort()).toEqual(made.map((hull) => hull.key).sort())
    expect(dented.filter((hull, i) => hull !== made[i]).length).toBeGreaterThan(0)
    expect(first.colliders.hulls().every((hull, i) => hull === made[i])).toBe(true)

    cache.dispose()
    expect(cache.stats()).toEqual({ models: 0, planned: 0, reused: 0 })
    first.dispose()
    second.dispose()
  }, 120000)

  it('a car that was dented before its hulls were made does not give them to its model', () => {
    const cache = createHullPlanCache()
    const hurt = collidersOf(MODEL, { planCache: cache })
    const meshes: THREE.Mesh[] = []
    ;(hurt.vehicle.vehicle.vehicle as THREE.Object3D).traverse((node) => {
      const candidate = node as THREE.Mesh
      if (candidate.isMesh && candidate.visible && candidate.geometry.getAttribute('position')) meshes.push(candidate)
    })
    for (const mesh of meshes) {
      const position = mesh.geometry.getAttribute('position')
      position.setX(0, position.getX(0) + 0.02)
      position.needsUpdate = true
    }
    hurt.colliders.pieces()
    hurt.colliders.hulls()
    expect(cache.stats().models).toBe(0)
    hurt.dispose()
  }, 120000)

  it('a car of the same key drawn differently makes its own', () => {
    const cache = createHullPlanCache()
    const first = collidersOf(MODEL, { planCache: cache, planKey: 'same' })
    first.colliders.hulls()
    const other = collidersOf('city_bus', { planCache: cache, planKey: 'same', maxHulls: 200 })
    other.colliders.hulls()
    expect(cache.stats()).toMatchObject({ planned: 2, reused: 0 })
    first.dispose()
    other.dispose()
  }, 120000)
})
