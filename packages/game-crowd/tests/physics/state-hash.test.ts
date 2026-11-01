import { describe, expect, it } from 'vitest'

import { CELL, STATE, createCrowd, createNavGrid } from '../../src'
import { BLAST_STEP, COMPRESS_STEPS, FASTEST_FIRST, createChainScene, makeTarget, mortarAt, packWithBalance, physicsOptions, runSteps } from './scenes'
import { hashCrowdState } from './state-hash'

/** The cadence range the default was before the variety work widened it to 0.85 to 1.15 (T4b.9). */
const PINNED_CADENCE = [0.88, 1.12] as const

/** Regression guard of the performance work: the whole struct of arrays after the same steps must stay byte for byte what it was before the contact and pressure loops were rewritten. */
describe('the full state of the crowd after N steps is pinned', () => {
  it('the queue and its grenade, 540 steps', () => {
    // the landing radius and the cadence range of the first runs of this guard, so that it keeps pinning the loops and not a default
    const scene = createChainScene({ physics: { ...FASTEST_FIRST, personality: { cadence: PINNED_CADENCE }, thrown: { ...(FASTEST_FIRST.thrown as object), priority: 'fastest', landingRadius: 0.7 } } })
    runSteps(scene, 540, (step) => {
      if (step === BLAST_STEP) scene.crowd.blast(mortarAt(scene.crowd))
    })
    expect(COMPRESS_STEPS).toBe(BLAST_STEP)
    expect(hashCrowdState(scene.crowd)).toBe('502b3de6')
  })

  it('800 agents packed against a wall with the target behind it, 300 steps', () => {
    const grid = createNavGrid({ size: 128, border: true })
    grid.fillRect(-15, -0.5, 15, 0.5, CELL.SOLID, 3)
    const { target } = makeTarget(0, 4)
    const crowd = createCrowd({ pack: packWithBalance(), seed: 21, grid, capacity: 1200, target, flow: { cellsPerStep: 20000, clock: () => 0 }, physics: physicsOptions({ personality: { cadence: PINNED_CADENCE } }) })
    for (let k = 0; k < 800; k++) {
      const row = Math.floor(k / 40)
      const i = crowd.spawn(((k % 40) - 20 + (row % 2) * 0.5) * 0.6, -1.5 - row * 0.55, k % 7 === 0 ? 3 : 0)
      crowd.store.state[i] = STATE.CHASE
    }
    for (let step = 0; step < 300; step++) crowd.update(1 / 60, { target, bandCentre: [0, -12] })
    expect(hashCrowdState(crowd)).toBe('b168b822')
  })
})
