import { undeadCrowdPack } from '@adatechnology/game-characters-undead'
import { describe, expect, it } from 'vitest'

import { PERSONALITY_DEFAULTS } from '../../src/physics/options'
import { STATE, createCrowd, createNavGrid } from '../../src'
import type { Crowd, CrowdPack } from '../../src'
import { makeTarget, packWithBalance, physicsOptions } from './scenes'

const horde = (physics: Parameters<typeof physicsOptions>[0], seed = 8, count = 400): Crowd => {
  const crowd = createCrowd({ pack: packWithBalance(), seed, grid: createNavGrid({ size: 256 }), capacity: count + 10, flow: { cellsPerStep: 20000, clock: () => 0 }, physics: physicsOptions(physics) })
  for (let k = 0; k < count; k++) crowd.spawn((k % 20) * 3 - 30, Math.floor(k / 20) * 3 - 30, 0)
  return crowd
}

const column = (crowd: Crowd, field: 'stability' | 'tripFactor' | 'driveFactor' | 'reaction' | 'cadenceFactor' | 'aggression'): number[] => Array.from({ length: crowd.store.n }, (_, i) => crowd.store[field][i]!)

describe('personality by seed (T4b.8)', () => {
  const crowd = horde({})
  const RANGES = { stability: PERSONALITY_DEFAULTS.stability, tripFactor: PERSONALITY_DEFAULTS.trip, driveFactor: PERSONALITY_DEFAULTS.drive, reaction: PERSONALITY_DEFAULTS.reaction, cadenceFactor: PERSONALITY_DEFAULTS.cadence, aggression: PERSONALITY_DEFAULTS.aggression } as const

  it.each(Object.entries(RANGES))('%s stays inside its range and differs from agent to agent, around the middle of the range', (field, range) => {
    const values = column(crowd, field as keyof typeof RANGES)
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    expect(Math.min(...values)).toBeGreaterThanOrEqual(range[0] - 1e-6)
    expect(Math.max(...values)).toBeLessThanOrEqual(range[1] + 1e-6)
    expect(new Set(values).size).toBeGreaterThan(values.length * 0.9)
    expect(Math.abs(mean - (range[0] + range[1]) / 2)).toBeLessThan((range[1] - range[0]) * 0.1)
  })

  it('every agent has an idle and a gait, drawn with the weights of the options', () => {
    const idles = Array.from({ length: crowd.store.n }, (_, i) => crowd.store.idle[i]!)
    expect(new Set(idles)).toEqual(new Set([0, 1, 2, 3]))
    const sways = idles.filter((idle) => idle === 0).length / idles.length
    expect(sways).toBeGreaterThan(0.3)
    expect(sways).toBeLessThan(0.5)
    const gaits = Array.from({ length: crowd.store.n }, (_, i) => crowd.store.gaitStyle[i]!)
    expect(Math.max(...gaits)).toBeLessThanOrEqual(5)
    expect(gaits.filter((gait) => gait === 0).length / gaits.length).toBeGreaterThan(0.45)
  })

  it('the same seed gives the same personalities, another seed gives others', () => {
    expect(column(horde({}), 'stability')).toEqual(column(crowd, 'stability'))
    const other = column(horde({}, 9), 'stability')
    expect(other.filter((value, i) => value === column(crowd, 'stability')[i]).length).toBeLessThan(10)
  })

  it('the speed factor multiplies the chase speed, between 0.9 and 1.1, and the draws of the game do not move', () => {
    const plain = horde({ personality: false })
    for (let i = 0; i < crowd.store.n; i++) {
      const ratio = crowd.store.chaseSpeed[i]! / plain.store.chaseSpeed[i]!
      expect(ratio).toBeGreaterThan(0.9 - 1e-4)
      expect(ratio).toBeLessThan(1.1 + 1e-4)
      expect(crowd.store.height[i]).toBe(plain.store.height[i])
      expect(crowd.store.color[i]).toBe(plain.store.color[i])
    }
    expect(plain.random()).toBe(crowd.random())
  })

  it('without the option every factor is neutral', () => {
    const plain = horde({ personality: false })
    for (const field of ['stability', 'tripFactor', 'driveFactor', 'cadenceFactor', 'aggression'] as const) expect(new Set(column(plain, field))).toEqual(new Set([1]))
    expect(new Set(column(plain, 'reaction'))).toEqual(new Set([0]))
  })
})

describe('aggression', () => {
  const attackers = (aggression: number, slots = 6): number => {
    const { target } = makeTarget(0, 0)
    const crowd = createCrowd({ pack: undeadCrowdPack() as unknown as CrowdPack, seed: 2, grid: createNavGrid({ size: 64 }), capacity: 40, target, flow: { clock: () => 0 }, numbers: { attackSlots: slots }, physics: physicsOptions({ personality: false }) })
    for (let k = 0; k < 10; k++) {
      const i = crowd.spawn(Math.cos(k) * 0.9, Math.sin(k) * 0.9, 0)
      crowd.store.state[i] = STATE.CHASE
      crowd.store.aggression[i] = aggression
    }
    let most = 0
    for (let step = 0; step < 30; step++) {
      crowd.update(1 / 60, { target })
      most = Math.max(most, crowd.stats.slots)
    }
    return most
  }

  it('the agents that are less aggressive than average never take the last two attack slots', () => {
    expect(attackers(1.1)).toBe(6)
    expect(attackers(0.9)).toBe(4)
  })

  it('it divides the time between attacks: the more aggressive agent attacks again sooner', () => {
    const timerAfterAttack = (aggression: number): number => {
      const { target } = makeTarget(0, 0)
      const crowd = createCrowd({ pack: undeadCrowdPack() as unknown as CrowdPack, seed: 2, grid: createNavGrid({ size: 64 }), capacity: 10, target, flow: { clock: () => 0 }, physics: physicsOptions({ personality: false }) })
      const i = crowd.spawn(0.9, 0, 0)
      crowd.store.state[i] = STATE.CHASE
      crowd.store.aggression[i] = aggression
      crowd.store.attackTimer[i] = 0
      for (let step = 0; step < 4; step++) crowd.update(1 / 60, { target })
      return crowd.store.attackTimer[i]!
    }
    expect(timerAfterAttack(1.2)).toBeLessThan(timerAfterAttack(0.8))
  })
})
