import { describe, expect, it } from 'vitest'

import { STATE, createCrowd, createNavGrid } from '../../src'
import type { CrowdPhysicsOptions } from '../../src'
import { BRUTE, WALKER, makeTarget, packWithBalance, physicsOptions } from './scenes'

const KNOCK_THRESHOLD = 1500
const STEPS = 240

/** A file of walkers pressing on a target that stands in front of a brute (the brute stops at arm length and takes the weight of the file). */
const pressOnTarget = (walkers: number, playerPressure: CrowdPhysicsOptions['playerPressure']) => {
  const { target, log } = makeTarget(0, -20)
  const crowd = createCrowd({
    pack: packWithBalance(),
    seed: 6,
    grid: createNavGrid({ size: 512 }),
    capacity: 60,
    target,
    flow: { cellsPerStep: 20000, clock: () => 0 },
    // nobody attacks: the only things the target can feel are the knock and the crush
    numbers: { attackSlots: 0 },
    physics: physicsOptions({ personality: false, ...(playerPressure ? { playerPressure } : {}) }),
  })
  for (let k = 0; k <= walkers; k++) {
    const i = crowd.spawn(0, -18.9 + k * 0.48, k === 0 ? BRUTE : WALKER)
    crowd.store.state[i] = STATE.CHASE
  }
  let peak = 0
  for (let step = 0; step < STEPS; step++) {
    crowd.update(1 / 60, { target, bandCentre: [0, -14] })
    peak = Math.max(peak, crowd.stats.physics.playerPressure)
  }
  return { crowd, log, peak }
}

describe('the pressure of the horde on the player (D13.2)', () => {
  const enabled = { enabled: true, knockThreshold: KNOCK_THRESHOLD, crushDamagePerSecond: 6 }

  it('under the threshold it does not knock the player down and does not hurt', () => {
    const { peak, log } = pressOnTarget(3, enabled)
    expect(peak).toBeGreaterThan(200)
    expect(peak).toBeLessThan(KNOCK_THRESHOLD)
    expect(log).toEqual([])
  })

  it('above the threshold it knocks the player down', () => {
    const { peak, log } = pressOnTarget(14, enabled)
    expect(peak).toBeGreaterThan(KNOCK_THRESHOLD)
    expect(log.filter((entry) => entry.startsWith('knock'))).not.toHaveLength(0)
  })

  it('above the threshold it crushes: damage every quarter of a second, more for a bigger excess', () => {
    const light = pressOnTarget(10, enabled)
    const heavy = pressOnTarget(14, enabled)
    const damage = (log: string[]): number => log.filter((entry) => entry.startsWith('hurt')).reduce((sum, entry) => sum + Number(entry.split(':')[1]), 0)
    expect(damage(heavy.log)).toBeGreaterThan(0)
    expect(damage(heavy.log)).toBeGreaterThan(damage(light.log))
  })

  it('a bigger threshold, from the sheet of the player, holds what a smaller one does not', () => {
    const { log } = pressOnTarget(14, { ...enabled, knockThreshold: 6000 })
    expect(log).toEqual([])
  })

  it('off, which is how the package ships, the same crush calls nothing on the player and measures nothing', () => {
    for (const playerPressure of [undefined, { enabled: false }] as const) {
      const { peak, log } = pressOnTarget(14, playerPressure)
      expect(log).toEqual([])
      expect(peak).toBe(0)
    }
  })
})
