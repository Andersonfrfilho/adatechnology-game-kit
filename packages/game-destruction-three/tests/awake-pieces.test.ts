import * as THREE from 'three'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import type { PhysicsWorld } from '@adatechnology/game-physics'
import { describe, expect, it } from 'vitest'

import { PieceSystem } from '../src/pieces'

/** The world calls that name one body: the ones that must not be made for a piece that sleeps. */
const PER_BODY_CALLS = ['readPose', 'readVelocity', 'isSleeping', 'setPose', 'setVelocity', 'wake', 'sleep', 'touching', 'setMotion', 'moveKinematic', 'addImpulse', 'contactPoints', 'setShape', 'setMaterial', 'setRolling']

type Counted = { world: PhysicsWorld; calls: Map<string, number>; activeCounts: number[] }

/** The world with every method counted by name (and what `readActiveBodies` answered), nothing else changed. */
const counted = (world: PhysicsWorld): Counted => {
  const calls = new Map<string, number>()
  const activeCounts: number[] = []
  const proxy = new Proxy(world, {
    get(target, key) {
      const value = Reflect.get(target, key, target) as unknown
      if (typeof value !== 'function') return value
      return (...args: unknown[]): unknown => {
        calls.set(String(key), (calls.get(String(key)) ?? 0) + 1)
        const result = (value as (...rest: unknown[]) => unknown).apply(target, args)
        if (key === 'readActiveBodies') activeCounts.push(result as number)
        return result
      }
    },
  })
  return { world: proxy, calls, activeCounts }
}

const newWorld = async (): Promise<PhysicsWorld> => (await createJoltEngine()).createWorld({ fixedStep: 1 / 120, velocityIterations: 20, sleepAfter: 0.5, sleepSpeed: 0.08 })

const makeSystem = (world: PhysicsWorld): PieceSystem => new PieceSystem(THREE, { groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene(), physics: world })

/** `count` boxes in a grid a metre apart, asleep from birth. */
const sleepers = (system: PieceSystem, count: number): void => {
  const across = Math.ceil(Math.sqrt(count))
  for (let i = 0; i < count; i++) {
    const root = new THREE.Object3D()
    root.position.set((i % across) * 1.5, 0.1, Math.floor(i / across) * 1.5)
    system.create(`sleeper-${i}`, root, [0.1, 0.1, 0.1], new THREE.Vector3(), 1).sleeping = true
  }
}

const UPDATES = 10

/** What the world was called per update once every piece sleeps (after the update that settles them). */
const callsPerUpdate = async (count: number): Promise<{ perBody: number; total: number; active: number }> => {
  const base = await newWorld()
  const { world, calls } = counted(base)
  const system = makeSystem(world)
  sleepers(system, count)
  system.update(0.05)
  calls.clear()
  for (let i = 0; i < UPDATES; i++) system.update(0.05)
  const perBody = PER_BODY_CALLS.reduce((sum, name) => sum + (calls.get(name) ?? 0), 0)
  const total = [...calls.values()].reduce((sum, n) => sum + n, 0)
  const active = calls.get('readActiveBodies') ?? 0
  base.dispose()
  return { perBody, total, active }
}

describe('the piece loops walk the awake pieces only', () => {
  it('with every piece asleep, no call names a piece and the calls per update do not grow with the count', async () => {
    const small = await callsPerUpdate(500)
    const large = await callsPerUpdate(5000)
    expect(small.perBody).toBe(0)
    expect(large.perBody).toBe(0)
    // the sleeping state of the engine is read in one batch per update
    expect(small.active).toBe(UPDATES)
    expect(large.active).toBe(UPDATES)
    expect(large.total).toBe(small.total)
    // counts calls, not time: 5,500 Jolt bodies take longer than the 5 s default to create on a loaded machine
  }, 30_000)

  it('a sleeping piece the engine wakes with a blow is read back in the same step', async () => {
    const base = await newWorld()
    const { world, activeCounts } = counted(base)
    const system = makeSystem(world)
    const lowerRoot = new THREE.Object3D()
    lowerRoot.position.set(0, 0.1, 0)
    const lower = system.create('lower', lowerRoot, [0.1, 0.1, 0.1], new THREE.Vector3(), 1)
    lower.sleeping = true
    const dropRoot = new THREE.Object3D()
    dropRoot.position.set(0, 1.2, 0)
    system.create('drop', dropRoot, [0.1, 0.1, 0.1], new THREE.Vector3(), 1)
    let wokenAt = -1
    let quietBefore = 0
    for (let i = 0; i < 80 && wokenAt < 0; i++) {
      system.update(0.02)
      const active = activeCounts[activeCounts.length - 1] ?? 0
      if (active >= 2) {
        wokenAt = i
        // the update the engine woke it in is the update the kit knows it
        expect(lower.sleeping).toBe(false)
      } else if (lower.sleeping) quietBefore++
    }
    expect(wokenAt).toBeGreaterThan(0)
    // it had been left out of the walks while it slept
    expect(quietBefore).toBeGreaterThan(2)
    base.dispose()
  })
})
