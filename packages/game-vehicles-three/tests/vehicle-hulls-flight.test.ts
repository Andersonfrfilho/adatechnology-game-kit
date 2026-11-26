import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import type { WorkerCoordinator } from '@adatechnology/game-contracts'

import { createHullPlanCache, createVehicleColliders } from '../src'
import type { VehicleColliders } from '../src'
import { planHulls } from '../src/worker-kinds'
import type { HullPlanJob, HullPlanResult } from '../src/worker-kinds'
import { build } from './vehicle-colliders-support'

const MODEL = 'naked_bike'
const MAX_HULLS = 64
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

type Car = ReturnType<typeof build>

const collidersOf = (car: Car, options: Partial<Parameters<typeof createVehicleColliders>[3]> = {}): VehicleColliders => {
  const colliders = createVehicleColliders(THREE, car.vehicle, car.frame, { hulls: true, maxHulls: MAX_HULLS, ...options })
  colliders.pieces()
  return colliders
}

/** A coordinator that keeps each job and answers or fails it when told. */
const holding = (): { workers: WorkerCoordinator; jobs: HullPlanJob[]; answer: (index: number) => void; fail: (index: number) => void } => {
  const jobs: HullPlanJob[] = []
  const settle: { resolve: (result: HullPlanResult) => void; reject: (error: Error) => void }[] = []
  const workers = {
    run: (_kind: unknown, job: HullPlanJob) => {
      jobs.push(job)
      return new Promise<HullPlanResult>((resolve, reject) => settle.push({ resolve, reject }))
    },
  } as unknown as WorkerCoordinator
  return { workers, jobs, answer: (index) => settle[index]!.resolve(planHulls(jobs[index]!)), fail: (index) => settle[index]!.reject(new Error('worker down')) }
}

const drive = (colliders: VehicleColliders, done: () => boolean): void => {
  for (let step = 0; step < 400 && !done(); step++) colliders.hulls()
  expect(done()).toBe(true)
}

const dent = (car: Car): void => {
  ;(car.vehicle.vehicle.vehicle as THREE.Object3D).traverse((node) => {
    const mesh = node as THREE.Mesh
    if (!mesh.isMesh || !mesh.visible || !mesh.geometry.getAttribute('position')) return
    const position = mesh.geometry.getAttribute('position')
    position.setX(0, position.getX(0) + 0.05)
    position.needsUpdate = true
  })
}

/** Takes parts off the car until one that is not a solid block and is drawn on its own (so it has pieces of its own in the plan) is gone. */
const loseAThinPart = (car: Car): string => {
  const solid = new Set(['light', 'mirror', 'engine', 'radiator', 'fuel_tank', 'oil_pan', 'battery', 'alternator', 'gearbox', 'steering', 'hitch'])
  const thinIds = new Set(car.vehicle.model.parts.filter((part) => part.visual && !solid.has(part.role)).map((part) => part.id))
  for (const joint of car.vehicle.model.joints) {
    const tool = joint.tools[0]
    if (!tool) continue
    for (let i = 0; i < 200 && car.vehicle.disassemble!(joint.id, tool, 0.2) < 1; i++) car.vehicle.update!(0.2)
    const gone = car.vehicle.detachedParts().find((id) => thinIds.has(id))
    if (gone) return gone
  }
  throw new Error('no thin part came off')
}

describe('a car whose pieces changed while its plan was in a worker', () => {
  it('drops the answer and plans again instead of failing on a leaf of a part that is gone', async () => {
    const { workers, jobs, answer } = holding()
    const car = build(MODEL)
    const colliders = collidersOf(car, { workers })
    drive(colliders, () => jobs.length > 0)
    const lost = loseAThinPart(car)
    answer(0)
    await sleep(0)
    colliders.pieces()
    expect(() => colliders.hulls()).not.toThrow()
    drive(colliders, () => jobs.length > 1)
    answer(1)
    await sleep(0)
    const made = colliders.hulls()
    expect(made.length).toBeGreaterThan(0)
    expect(made.some((hull) => hull.id === lost)).toBe(false)
    car.dispose()
  }, 120000)
})

describe('a car that was dented does not take part in the plan of its model', () => {
  it('is not given the hulls the cache holds, and does not send its dents to the cars that come after', async () => {
    const cache = createHullPlanCache()
    const intact = build(MODEL)
    const reference = collidersOf(intact, { planCache: cache }).hulls()
    const hurt = build(MODEL)
    const hurtColliders = collidersOf(hurt, { planCache: cache })
    dent(hurt)
    hurtColliders.pieces()
    const hurtHulls = hurtColliders.hulls()
    expect(hurtHulls.some((hull, index) => hull === reference[index])).toBe(false)
    intact.dispose()
    hurt.dispose()
    cache.dispose()
  }, 120000)

  it('does not put its flight in the cache: the intact car of the model sends its own and gets the intact hulls', async () => {
    const { workers, jobs, answer } = holding()
    const cache = createHullPlanCache()
    const hurt = build(MODEL)
    const hurtColliders = collidersOf(hurt, { workers, planCache: cache })
    dent(hurt)
    hurtColliders.pieces()
    drive(hurtColliders, () => jobs.length > 0)
    const whole = build(MODEL)
    const wholeColliders = collidersOf(whole, { workers, planCache: cache })
    drive(wholeColliders, () => jobs.length > 1)
    expect(jobs).toHaveLength(2)
    answer(0)
    answer(1)
    await sleep(0)
    const received = wholeColliders.hulls()
    const alone = build(MODEL)
    expect(received.map((hull) => Array.from(hull.points))).toEqual(collidersOf(alone).hulls().map((hull) => Array.from(hull.points)))
    hurt.dispose()
    whole.dispose()
    alone.dispose()
    cache.dispose()
  }, 120000)
})

describe('when the worker fails', () => {
  it('the cars waiting on the same flight plan once between them: the first makes it, the next is given it', async () => {
    const { workers, jobs, fail } = holding()
    const cache = createHullPlanCache()
    const first = build(MODEL)
    const second = build(MODEL)
    const firstColliders = collidersOf(first, { workers, planCache: cache })
    const secondColliders = collidersOf(second, { workers, planCache: cache })
    drive(firstColliders, () => jobs.length > 0)
    for (let step = 0; step < 50; step++) secondColliders.hulls()
    fail(0)
    await sleep(0)
    const a = firstColliders.hulls()
    const b = secondColliders.hulls()
    expect(a.length).toBeGreaterThan(0)
    expect(b.every((hull, index) => hull === a[index])).toBe(true)
    expect(cache.stats().reused).toBe(1)
    first.dispose()
    second.dispose()
    cache.dispose()
  }, 120000)
})
