import { describe, expect, it } from 'vitest'

import { BRUTE, WALKER, createColumnScene, packWithBalance, packWithoutBalance, runSteps } from './scenes'

const RUNNER = 1

/** One agent against the wall, personality off: its field is its own drive, so the drive force of its type is what the field reads. */
const fieldOfLoneAgent = (type: number, pack = packWithBalance()): number => {
  const scene = createColumnScene(1, { typeAt: () => type, pack })
  runSteps(scene, 60)
  return scene.crowd.store.field[0]!
}

describe('the balance table of the undead pack reaches the crowd', () => {
  it('the drive of a lone agent is the drive force of its type', () => {
    expect(fieldOfLoneAgent(WALKER)).toBe(250)
    expect(fieldOfLoneAgent(RUNNER)).toBe(320)
    expect(fieldOfLoneAgent(BRUTE)).toBe(600)
  })

  it('a pack without the table makes every type use the defaults (drive 250)', () => {
    const bare = packWithoutBalance()
    expect(bare.types.every((type) => type.balance === undefined)).toBe(true)
    expect(fieldOfLoneAgent(BRUTE, bare)).toBe(250)
    expect(fieldOfLoneAgent(RUNNER, bare)).toBe(250)
  })
})
