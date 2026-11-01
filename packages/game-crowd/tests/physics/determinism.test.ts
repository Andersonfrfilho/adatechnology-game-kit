import { undeadCrowdPack } from '@adatechnology/game-characters-undead'
import { describe, expect, it } from 'vitest'

import { FALL_CAUSE, STATE, createCrowd, createNavGrid } from '../../src'
import type { Crowd, CrowdPack } from '../../src'
import { COMPRESS_STEPS, FASTEST_FIRST, createChainScene, createQueueScene, makeTarget, mortarAt, runFixed, runSteps } from './scenes'

const TOTAL_STEPS = 540
const FRAME_RATES = [30, 60, 144] as const

const snapshotOf = (crowd: Crowd): Record<string, number[]> => {
  const { store } = crowd
  const take = (array: ArrayLike<number>): number[] => Array.from({ length: store.n }, (_, i) => array[i]!)
  return { n: [store.n], x: take(store.x), z: take(store.z), y: take(store.y), pushX: take(store.pushX), pushZ: take(store.pushZ), hp: take(store.hp), balance: take(store.balance), state: take(store.state) }
}

describe('the same seed gives the same result at 30, 60 and 144 frames per second', () => {
  const runAt = (fps: number): { snapshot: Record<string, number[]>; events: string[] } => {
    const scene = createChainScene()
    const events: string[] = []
    scene.crowd.on('fall', (event) => events.push(`fall:${event.identity}:${event.cause}`))
    scene.crowd.on('kill', (event) => events.push(`kill:${event.agent}`))
    scene.crowd.on('blasted', (event) => events.push(`blasted:${event.reached}:${event.killed}:${event.thrown}`))
    runFixed(scene.crowd, fps, TOTAL_STEPS, scene.context, (step) => {
      if (step === COMPRESS_STEPS) scene.crowd.blast(mortarAt(scene.crowd))
    })
    return { snapshot: snapshotOf(scene.crowd), events }
  }

  it('540 fixed steps of the queue and its grenade: every array and every event is identical byte for byte', () => {
    const [reference, ...others] = FRAME_RATES.map(runAt)
    expect(reference!.events.some((event) => event.startsWith('fall'))).toBe(true)
    for (const other of others) {
      expect(other.snapshot).toEqual(reference!.snapshot)
      expect(other.events).toEqual(reference!.events)
    }
  })

  it('two runs of the same scene are the same', () => {
    expect(runAt(60)).toEqual(runAt(60))
  })
})

describe('the order the agents were born in does not matter', () => {
  const fallsAfter = (reversed: boolean): { total: number; tail: number } => {
    const scene = createQueueScene({ columns: 8, rows: 30, physics: { ...FASTEST_FIRST, personality: false }, reversed })
    runSteps(scene, COMPRESS_STEPS)
    const tail = Math.max(...Array.from({ length: scene.crowd.store.n }, (_, i) => scene.crowd.store.z[i]!))
    scene.crowd.blast(mortarAt(scene.crowd))
    const before = scene.crowd.stats.physics.falls.reduce((sum, value) => sum + value, 0)
    runSteps(scene, 240)
    return { total: scene.crowd.stats.physics.falls.reduce((sum, value) => sum + value, 0) - before, tail }
  }

  // The count of the chain falls (`fallsBeyondBlast`) is not compared: it is decided by where four or five bodies land, and the same queue born in the two orders differs by 5 cm in the
  // position of its tail after 300 steps (measured: 0 against 5 chain falls). The falls the grenade gives directly are the stable number.
  it('the same queue born from the front and from the back falls within 10% after the grenade, and closes up to the same tail within 10 cm', () => {
    const forward = fallsAfter(false)
    const backward = fallsAfter(true)
    expect(forward.total).toBeGreaterThan(10)
    expect(Math.abs(forward.total - backward.total)).toBeLessThanOrEqual(Math.max(1, 0.1 * forward.total))
    expect(Math.abs(forward.tail - backward.tail)).toBeLessThan(0.1)
  })
})

describe('with the physics off the horde is the game one', () => {
  const horde = (physics: undefined | Record<string, never>): Record<string, number[]> => {
    const { target } = makeTarget(0, 0)
    const crowd = createCrowd({ pack: undeadCrowdPack() as unknown as CrowdPack, seed: 4, grid: createNavGrid({ size: 256 }), capacity: 300, target, flow: { clock: () => 0 }, ...(physics ? { physics } : {}) })
    for (let k = 0; k < 150; k++) {
      const i = crowd.spawn(((k % 15) - 7) * 2.2, -6 - Math.floor(k / 15) * 2.5)
      if (k % 3 === 0) crowd.store.state[i] = STATE.CHASE
    }
    for (let step = 0; step < 240; step++) crowd.update(1 / 60, { target })
    return snapshotOf(crowd)
  }

  it('physics: {} is the same as no physics at all', () => {
    expect(horde({})).toEqual(horde(undefined))
  })

  it('a blast without physics hurts, kills and stuns, and writes nothing of the physics', () => {
    const grid = createNavGrid({ size: 128 })
    const crowd = createCrowd({ pack: undeadCrowdPack() as unknown as CrowdPack, seed: 4, grid, capacity: 100, flow: { clock: () => 0 } })
    for (let k = 0; k < 20; k++) crowd.spawn((k - 10) * 0.8, -5)
    const before = crowd.store.n
    crowd.blast({ point: [0, 0.3, -5], energy: 200000, radius: 15, lethalRadius: 3 })
    crowd.update(1 / 60, { flowTarget: [0, -60] })
    const { store, stats } = crowd
    expect(store.n).toBeLessThan(before)
    let stunned = 0
    for (let i = 0; i < store.n; i++) {
      expect(store.pushX[i]).toBe(0)
      expect(store.balance[i]).toBe(0)
      if (store.state[i] === STATE.STUNNED) stunned++
    }
    expect(stunned).toBeGreaterThan(0)
    expect(stats.physics.falls).toEqual([0, 0, 0, 0, 0, 0])
    expect(stats.physics.thrownPeak).toBe(0)
    expect(stats.physics.blastChecks).toBeGreaterThan(0)
    expect(FALL_CAUSE.BLAST).toBe(6)
  })
})
