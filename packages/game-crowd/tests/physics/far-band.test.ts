import { describe, expect, it } from 'vitest'

import { BALANCE, STATE, createCrowd, createNavGrid } from '../../src'
import type { Crowd, CrowdPhysicsOptions } from '../../src'
import { makeTarget, packWithBalance, physicsOptions } from './scenes'

const STEP = 1 / 60
/** The context of every scene here: the bands are centred at the origin, so z = 60 is band R1 (35 to 120 m). */
const { target: TARGET } = makeTarget(0, -200)
const CONTEXT = { target: TARGET, bandCentre: [0, 0] as [number, number] }

type Cluster = { readonly x: number; readonly z: number; readonly count: number; readonly spacing: number }

const createFarScene = (clusters: readonly Cluster[], physics: CrowdPhysicsOptions = physicsOptions({ personality: false })): Crowd => {
  const crowd = createCrowd({ pack: packWithBalance(), seed: 9, grid: createNavGrid({ size: 512, border: true }), capacity: 4000, flow: { cellsPerStep: 20000, clock: () => 0 }, physics })
  for (const cluster of clusters) {
    const side = Math.ceil(Math.sqrt(cluster.count))
    for (let k = 0; k < cluster.count; k++) {
      const i = crowd.spawn(cluster.x + (k % side) * cluster.spacing, cluster.z + Math.floor(k / side) * cluster.spacing, 0)
      crowd.store.state[i] = STATE.CHASE
    }
  }
  return crowd
}

const run = (crowd: Crowd, steps: number): void => {
  for (let step = 0; step < steps; step++) crowd.update(STEP, CONTEXT)
}

const speedOf = (crowd: Crowd, i: number): number => Math.hypot(crowd.store.dvx[i]!, crowd.store.dvz[i]!)

describe('band R1 without pairs', () => {
  const THICK = { x: 40, z: 60, count: 100, spacing: 0.2 }
  const LONE = { x: -60, z: 60, count: 1, spacing: 1 }

  it('a thick crowd far away slows by capacity over bodies and presses by 150 N per body above 4', () => {
    const crowd = createFarScene([THICK, LONE])
    run(crowd, 40)
    const lone = THICK.count
    expect(crowd.store.band[0]).toBe(1)
    expect(crowd.store.field[lone]).toBe(0)
    const loneSpeed = speedOf(crowd, lone)
    expect(loneSpeed).toBeGreaterThan(1)
    let slowest = Infinity
    let pressed = 0
    for (let i = 0; i < THICK.count; i++) {
      slowest = Math.min(slowest, speedOf(crowd, i))
      pressed = Math.max(pressed, crowd.store.field[i]!)
    }
    expect(slowest).toBeLessThan(loneSpeed * 0.3)
    expect(pressed).toBeGreaterThan(300)
    expect(pressed % 150).toBeCloseTo(0, 3)
  })

  it('no pair of contact is solved there: the contacts of the step are 0 with the whole cluster in band R1', () => {
    const crowd = createFarScene([THICK])
    run(crowd, 30)
    expect(crowd.stats.bands[0]).toBe(0)
    expect(crowd.stats.physics.contacts).toBe(0)
  })

  it('a very thick crowd falls by pressure with the rule of band R0, and the fallen lie there without entering the mound', () => {
    const crowd = createFarScene([{ x: 40, z: 60, count: 60, spacing: 0.2 }])
    run(crowd, 240)
    expect(crowd.stats.physics.falls[0]).toBeGreaterThan(0)
    let lying = 0
    for (let i = 0; i < crowd.store.n; i++) if (crowd.store.balance[i] === BALANCE.FALLEN) lying++
    expect(lying).toBeGreaterThan(0)
    expect(crowd.stats.physics.moundMax).toBe(0)
  })

  it('band R0 is untouched: the same scene with the density off gives the same bytes when every agent is in R0', () => {
    const near = (physics: CrowdPhysicsOptions): Crowd => {
      const crowd = createFarScene([{ x: -3, z: 4, count: 100, spacing: 0.5 }], physics)
      for (let step = 0; step < 200; step++) crowd.update(STEP, { target: TARGET, bandCentre: [0, 4] })
      return crowd
    }
    const withDensity = near(physicsOptions({ personality: false }))
    const without = near(physicsOptions({ personality: false, density: false }))
    expect(withDensity.stats.bands[0]).toBeGreaterThan(90)
    expect(Array.from(withDensity.store.x.subarray(0, 100))).toEqual(Array.from(without.store.x.subarray(0, 100)))
    expect(Array.from(withDensity.store.pushX.subarray(0, 100))).toEqual(Array.from(without.store.pushX.subarray(0, 100)))
  })

  it('costs one pass over the agents: 3000 agents in band R1 take a few milliseconds a step', () => {
    const clusters: Cluster[] = []
    for (let k = 0; k < 30; k++) clusters.push({ x: -70 + (k % 10) * 14, z: 40 + Math.floor(k / 10) * 12, count: 100, spacing: 0.8 })
    const crowd = createFarScene(clusters)
    run(crowd, 60)
    const times: number[] = []
    for (let step = 0; step < 60; step++) {
      const start = performance.now()
      crowd.update(STEP, CONTEXT)
      times.push(performance.now() - start)
    }
    times.sort((a, b) => a - b)
    expect(crowd.stats.bands[1]).toBeGreaterThan(2500)
    expect(crowd.stats.physics.contacts).toBe(0)
    expect(times[Math.floor(times.length / 2)]!).toBeLessThan(8)
  })
})
