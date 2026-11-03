import { describe, expect, it } from 'vitest'

import { BALANCE, FALL_CAUSE, STATE, createCrowd, createNavGrid } from '../../src'
import type { Crowd } from '../../src'
import { makeTarget, packWithBalance, physicsOptions } from './scenes'

const STEP = 1 / 60
const BODY_THICKNESS = 0.28

const newCrowd = (physics = physicsOptions({ personality: false })): Crowd =>
  createCrowd({ pack: packWithBalance(), seed: 3, grid: createNavGrid({ size: 128 }), capacity: 200, flow: { cellsPerStep: 20000, clock: () => 0 }, physics })

/** An agent that stays where it is (stunned for a long time), standing or lying. */
const place = (crowd: Crowd, x: number, z: number, y: number, balance: number, yaw = 0): number => {
  const i = crowd.spawn(x, z, 0)
  const { store } = crowd
  store.yaw[i] = store.renderYaw[i] = yaw
  store.state[i] = STATE.STUNNED
  store.stateTimer[i] = 1000
  store.balance[i] = balance
  store.y[i] = y
  store.band[i] = 0
  store.height[i] = 1
  store.build[i] = 1
  store.mass[i] = 70
  return i
}

const update = (crowd: Crowd, steps: number): void => {
  for (let step = 0; step < steps; step++) crowd.update(STEP, { bandCentre: [0, 0], flowTarget: [0, 0] })
}

describe('the mound does not depend on the order of the agents', () => {
  const moundOf = (reversed: boolean): Uint16Array => {
    const crowd = newCrowd()
    const places: [number, number, number][] = []
    for (let column = 0; column < 12; column++) for (let layer = 0; layer < 3; layer++) places.push([-8.25 + column * 1.3, -5.25, layer * BODY_THICKNESS])
    if (reversed) places.reverse()
    // the yaw follows the place, not the birth, as the identities would in a real pile
    for (const [x, z, y] of places) place(crowd, x, z, y, BALANCE.FALLEN, x * 0.37 + y)
    update(crowd, 1)
    return crowd.mound.slice()
  }

  it('the same bodies in the same places, born in the opposite order, give the same millimetres in every cell', () => {
    const forward = moundOf(false)
    const backward = moundOf(true)
    expect(Math.max(...forward)).toBeGreaterThanOrEqual(3 * Math.round(BODY_THICKNESS * 1000))
    expect(Array.from(backward)).toEqual(Array.from(forward))
  })
})

describe('a mound that gives way', () => {
  it('three lying bodies in a stack and one standing on them: when the base goes, the one on top drops and falls or staggers by collapse', () => {
    const crowd = newCrowd()
    const base = [0, 1, 2].map((layer) => place(crowd, 5.25, -5.25, layer * BODY_THICKNESS, BALANCE.FALLEN))
    const top = place(crowd, 5.25, -5.25, 3 * BODY_THICKNESS, BALANCE.STANDING)
    update(crowd, 1)
    expect(crowd.stats.physics.moundMax).toBeCloseTo(3 * BODY_THICKNESS, 1)
    expect(crowd.store.y[top]).toBeCloseTo(3 * BODY_THICKNESS, 1)
    const identity = crowd.store.identity[top]!
    for (const index of base.sort((a, b) => b - a)) crowd.remove(index)
    const at = (): number => Array.from({ length: crowd.store.n }, (_, i) => i).find((i) => crowd.store.identity[i] === identity)!
    const before = crowd.store.y[at()]!
    let reeled = false
    let fellByCollapse = false
    for (let step = 0; step < 60; step++) {
      update(crowd, 1)
      const i = at()
      reeled ||= crowd.store.balance[i] === BALANCE.STAGGERING || crowd.store.balance[i] === BALANCE.FALLEN
      fellByCollapse ||= crowd.store.balance[i] === BALANCE.FALLEN && crowd.store.fallCause[i] === FALL_CAUSE.COLLAPSE
    }
    expect(crowd.store.y[at()]!).toBeLessThan(before)
    expect(reeled).toBe(true)
    // a drop of 0.84 m (under 1 m) staggers; it only knocks down from 1 m
    expect(fellByCollapse).toBe(false)
  })

  it('a body of the pile against a wall that goes takes the steps behind it in its column down: they are airborne with no push', () => {
    const { target } = makeTarget(0, 0)
    const crowd = createCrowd({ pack: packWithBalance(), seed: 3, grid: createNavGrid({ size: 128 }), capacity: 50, target, flow: { cellsPerStep: 20000, clock: () => 0 }, physics: physicsOptions({ personality: false }) })
    const steps = [0, 1, 2].map((k) => {
      const i = crowd.spawn(3 - k * 0.5, 0, 0)
      const cell = crowd.grid.cellOf(3 - k * 0.5, 0)
      crowd.store.state[i] = STATE.PILE_STEP
      crowd.store.stateTimer[i] = 100
      crowd.store.stepCell[i] = cell
      crowd.store.stepDir[i] = 1
      crowd.pile[cell] = 0.48
      return i
    })
    crowd.remove(steps[0]!)
    crowd.update(STEP, { target })
    for (const i of [0, 1]) {
      expect(crowd.store.state[i]).toBe(STATE.AIRBORNE)
      expect(crowd.store.stepCell[i]).toBe(-1)
    }
  })
})

describe('the weight of a pile on a body under it', () => {
  it('a body with someone standing on it takes damage by the weight, and gets none without', () => {
    const crowd = newCrowd()
    const crushed = place(crowd, 5.25, -5.25, 0, BALANCE.FALLEN)
    const alone = place(crowd, -5.25, -5.25, 0, BALANCE.FALLEN)
    place(crowd, 5.25, -5.25, BODY_THICKNESS, BALANCE.STANDING)
    const hp = crowd.store.hp[crushed]!
    update(crowd, 60)
    expect(crowd.store.hp[crushed]!).toBeLessThan(hp - 3)
    expect(crowd.store.hp[alone]).toBe(crowd.store.hpMax[alone])
  })
})
