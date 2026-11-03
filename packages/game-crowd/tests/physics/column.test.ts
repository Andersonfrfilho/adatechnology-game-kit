import { describe, expect, it } from 'vitest'

import { BRUTE, WALKER, createColumnScene, frontOf, runSteps } from './scenes'

const TRANSMISSION = 0.97
const DRIVE = 250
const CLOSE_UP_STEPS = 300

/** What a front gets from a file of `count` walkers that has closed up: D · (1 − τᴺ) / (1 − τ). */
const fileField = (count: number): number => (DRIVE * (1 - TRANSMISSION ** count)) / (1 - TRANSMISSION)

describe('pressure field: a column of walkers against a wall', () => {
  it.each([2, 4, 6, 10])('the front of %i walkers gets N times the drive, within 25%', (count) => {
    const scene = createColumnScene(count)
    let peakField = 0
    let peakMean = 0
    runSteps(scene, CLOSE_UP_STEPS, (step) => {
      if (step < count) return
      const front = frontOf(scene.crowd)
      peakField = Math.max(peakField, scene.crowd.store.field[front]!)
      peakMean = Math.max(peakMean, scene.crowd.store.pressure[front]!)
    })
    expect(peakField).toBeGreaterThan(count * DRIVE * 0.75)
    expect(peakField).toBeLessThan(count * DRIVE * 1.25)
    expect(peakField).toBeCloseTo(fileField(count), -1)
    expect(peakMean).toBeGreaterThan(count * DRIVE * 0.75)
    expect(peakMean).toBeLessThan(count * DRIVE * 1.25)
  })

  it('the field moves one hop per step: after k steps nobody is further than k hops behind', () => {
    const scene = createColumnScene(10)
    runSteps(scene, 10, (step) => {
      let highest = 0
      for (let i = 0; i < scene.crowd.store.n; i++) highest = Math.max(highest, scene.crowd.store.field[i]!)
      expect(highest).toBeLessThanOrEqual((DRIVE * (1 - TRANSMISSION ** step)) / (1 - TRANSMISSION) * (1 + 1e-4))
    })
  })

  it('five walkers or fewer never knock the front down; ten do, by pressure', () => {
    for (const count of [2, 3, 4, 5]) {
      const scene = createColumnScene(count)
      runSteps(scene, 600)
      expect(scene.crowd.stats.physics.falls.reduce((sum, value) => sum + value, 0)).toBe(0)
    }
    const ten = createColumnScene(10)
    runSteps(ten, 600)
    expect(ten.crowd.stats.physics.falls[0]).toBeGreaterThanOrEqual(1)
    expect(ten.crowd.stats.physics.falls.slice(1).reduce((sum, value) => sum + value, 0)).toBe(0)
  })

  it('a brute at the front of 20 walkers never falls: the field stays under its critical pressure and under the ceiling', () => {
    const scene = createColumnScene(21, { typeAt: (index) => (index === 0 ? BRUTE : WALKER) })
    const { crowd } = scene
    const bruteFalls: number[] = []
    crowd.on('fall', (event) => {
      if (crowd.store.type[event.agent] === BRUTE) bruteFalls.push(event.agent)
    })
    let peak = 0
    runSteps(scene, 600, () => {
      peak = Math.max(peak, crowd.store.field[frontOf(crowd)]!)
    })
    expect(bruteFalls).toEqual([])
    expect(peak).toBeLessThan(6000)
    expect(crowd.store.type[frontOf(crowd)]).toBe(BRUTE)
  })

  it('the same file born in the opposite order gets the same field in every place', () => {
    // four walkers stay below the critical pressure: with no fall to draw, the lottery of the identities cannot tell the two files apart
    const forward = createColumnScene(4)
    const reversed = createColumnScene(4, { reversed: true })
    runSteps(forward, CLOSE_UP_STEPS)
    runSteps(reversed, CLOSE_UP_STEPS)
    for (let place = 0; place < 4; place++) {
      const a = forward.crowd.store.field[place]!
      const b = reversed.crowd.store.field[3 - place]!
      expect(Math.abs(a - b)).toBeLessThanOrEqual(1e-3 * Math.max(a, b, 1))
    }
  })
})
