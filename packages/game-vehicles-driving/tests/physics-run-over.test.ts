import { describe, expect, it } from 'vitest'

import type { PhysicsLoop, PhysicsPhase } from '@adatechnology/game-physics'

import { createRunOver } from '../src'
import type { RunOverCrowd, RunOverHit } from '../src'

const STEP = 1 / 120
const CAR = 1 as never
const CAR_MASS = 1300
const KMH = 1 / 3.6

type Impulse = { readonly impulse: readonly number[]; readonly point: readonly number[] | undefined }

/** A world with one car moving along +z and agent capsules `100 + i`; the query answers with every capsule given. */
const scene = (speed: number, agentZ: readonly number[], mass = 100) => {
  const impulses: Impulse[] = []
  let phase: PhysicsPhase | undefined
  const world = {
    readVelocity: (_body: unknown, out: Float64Array) => void out.set([0, 0, speed, 0, 0, 0]),
    readPose: (_body: unknown, out: Float64Array) => void out.set([0, 0.5, 0, 0, 0, 0, 1]),
    massOf: () => CAR_MASS,
    overlapShape: (_shape: unknown, _position: unknown, _rotation: unknown, out: number[]) => {
      out.length = 0
      agentZ.forEach((_z, index) => out.push(100 + index))
      return out.length
    },
    addImpulse: (_body: unknown, impulse: readonly number[], point?: readonly number[]) => void impulses.push({ impulse: [...impulse], point }),
  }
  const loop = { world, add: (added: PhysicsPhase) => ((phase = added), () => undefined) } as unknown as PhysicsLoop
  const kills: number[] = []
  const stuns: number[] = []
  const store = {
    n: agentZ.length,
    x: new Float32Array(agentZ.length),
    z: Float32Array.from(agentZ),
    vx: new Float32Array(agentZ.length),
    vz: new Float32Array(agentZ.length),
    mass: new Float32Array(agentZ.length).fill(mass),
    identity: Uint32Array.from(agentZ.map((_z, index) => index + 1)),
  }
  const crowd: RunOverCrowd = {
    store,
    damage: (_index, hit) => ({ died: hit.amount >= 100 }),
    kill: (index) => void kills.push(index),
    knockDown: (index) => void stuns.push(index),
  }
  const hits: RunOverHit[] = []
  const runOver = createRunOver(loop, { crowd, agents: { count: agentZ.length, bodyOf: (index) => (100 + index) as never }, onHit: (hit) => hits.push(hit) })
  runOver.track({ body: CAR, half: [0.9, 0.5, 2.2] })
  return { runOver, hits, kills, stuns, impulses, step: () => phase!.beforeStep!(STEP, undefined as never), store }
}

describe('createRunOver (T6.26): the sweep of a car against the agents, without an engine', () => {
  it('a car at 30 km/h kills: the body goes at the common speed and the car loses the momentum, within 5%', () => {
    const { hits, kills, impulses, step } = scene(30 * KMH, [3], 100)
    step()
    expect(kills).toEqual([0])
    expect(hits).toMatchObject([{ outcome: 'kill', vehicleDamage: 3 }])
    const common = (CAR_MASS * 30 * KMH) / (CAR_MASS + 100)
    expect(Math.abs(-impulses[0]!.impulse[2]! / CAR_MASS - (30 * KMH - common)) / (30 * KMH)).toBeLessThan(0.05)
    expect(Math.abs(CAR_MASS * 30 * KMH - (CAR_MASS * common + 100 * common)) / (CAR_MASS * 30 * KMH)).toBeLessThan(1e-9)
    expect(impulses[0]!.point).toEqual([0, 0.5, 3])
  })

  it('the energy follows the reduced mass and the speed; below the kill speed the damage decides if the body lives', () => {
    const light = scene(6, [3], 40)
    light.step()
    const heavy = scene(6, [3], 150)
    heavy.step()
    expect(light.hits[0]).toMatchObject({ outcome: 'knock', vehicleDamage: 0 })
    expect(light.stuns).toEqual([0])
    expect(heavy.kills).toEqual([])
    expect(heavy.hits[0]!.energy).toBeGreaterThan(light.hits[0]!.energy)
    expect(heavy.hits[0]!.energy).toBeCloseTo(0.5 * ((150 * CAR_MASS) / (150 + CAR_MASS)) * 36, 6)
    const dies = scene(6, [3], 400)
    dies.step()
    expect(dies.hits[0]).toMatchObject({ outcome: 'knock', vehicleDamage: 3 })
    expect(dies.stuns).toEqual([])
  })

  it('5 km/h only pushes: the body moves aside, nobody is hurt, the car is held by holdDrag', () => {
    const { hits, kills, stuns, impulses, store, step } = scene(5 * KMH, [3])
    step()
    expect(hits).toMatchObject([{ outcome: 'push', vehicleDamage: 0 }])
    expect(kills).toEqual([])
    expect(stuns).toEqual([])
    expect(store.x[0]).toBeLessThan(0)
    expect(-impulses[0]!.impulse[2]!).toBeCloseTo(CAR_MASS * 5 * KMH * (1 - Math.exp(-2.5 * STEP)), 6)
  })

  it('a body is struck once while it stays under the car, a push is held every step, and a car under 1 m/s runs nobody over', () => {
    const crossing = scene(8, [3])
    crossing.step()
    crossing.step()
    expect(crossing.hits).toHaveLength(1)
    const pushing = scene(1.2, [3])
    pushing.step()
    pushing.step()
    expect(pushing.hits).toHaveLength(2)
    const crawling = scene(0.9, [3])
    crawling.step()
    expect(crawling.hits).toHaveLength(0)
  })

  it('the agents are handled from the highest index down, so a death never moves a body not yet handled', () => {
    const { kills, step } = scene(20, [2, 3, 4])
    step()
    expect(kills).toEqual([2, 1, 0])
  })
})
