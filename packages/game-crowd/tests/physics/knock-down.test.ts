import { describe, expect, it } from 'vitest'

import { BALANCE, createCrowd, createNavGrid, STATE } from '../../src'
import type { Crowd } from '../../src'
import { packWithBalance, physicsOptions } from './scenes'

const crowdOf = (): Crowd => createCrowd({ pack: packWithBalance(), seed: 3, grid: createNavGrid({ size: 64 }), capacity: 8, flow: { cellsPerStep: 20000, clock: () => 0 }, physics: physicsOptions({ personality: false }) })

describe('knockDown (what a car that runs someone over calls)', () => {
  it('pushes an agent that stands, and one that staggers', () => {
    const crowd = crowdOf()
    const i = crowd.spawn(10, 10, 0)
    crowd.store.state[i] = STATE.DORMANT
    crowd.knockDown(i, { x: 2, z: -1 })
    expect(crowd.store.pushX[i]).toBe(2)
    crowd.store.balance[i] = BALANCE.STAGGERING
    crowd.knockDown(i, { x: 1, z: 0 })
    expect(crowd.store.pushX[i]).toBe(3)
  })

  it('adds no push to an agent already down, getting up or thrown', () => {
    const crowd = crowdOf()
    const i = crowd.spawn(10, 10, 0)
    crowd.store.state[i] = STATE.DORMANT
    for (const balance of [BALANCE.FALLEN, BALANCE.GETTING_UP, BALANCE.THROWN]) {
      crowd.store.balance[i] = balance
      crowd.knockDown(i, { x: 2, z: 2 })
      expect(crowd.store.pushX[i]).toBe(0)
      expect(crowd.store.pushZ[i]).toBe(0)
    }
  })

  it('ignores an index that is not an agent (past the last one, or negative)', () => {
    const crowd = crowdOf()
    crowd.spawn(10, 10, 0)
    const past = crowd.store.n
    crowd.store.hp[past] = 10
    crowd.knockDown(past, { x: 2, z: 2 })
    expect(crowd.store.pushX[past]).toBe(0)
    expect(() => crowd.knockDown(-1, { x: 1, z: 1 })).not.toThrow()
  })
})
