import { describe, expect, it } from 'vitest'

import { FALL_CAUSE } from '../../src'
import { BRUTE, COMPRESS_STEPS, createChainScene, createQueueScene, mortarAt, runChain, runSteps } from './scenes'
import type { FallRecord } from './scenes'

const SHOVE_STAGGER = 1.2
const CHAIN_CAUSES: number[] = [FALL_CAUSE.LANDING, FALL_CAUSE.SHOVE, FALL_CAUSE.COLLAPSE, FALL_CAUSE.TRIP]

const median = (values: readonly number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0
const distance = (fall: FallRecord, point: readonly [number, number, number]): number => Math.hypot(fall.x - point[0], fall.z - point[2])

describe('a grenade in a queue pressed against a wall', () => {
  const run = runChain(createChainScene())
  const direct = run.falls.filter((fall) => fall.cause === FALL_CAUSE.BLAST)
  const beyond = run.falls.filter((fall) => CHAIN_CAUSES.includes(fall.cause) && fall.direct < SHOVE_STAGGER)

  it('throws down at least 20 walkers directly, all of them within 9 m of the grenade', () => {
    expect(direct.length).toBeGreaterThanOrEqual(20)
    expect(Math.max(...direct.map((fall) => distance(fall, run.blast.point)))).toBeLessThan(9)
  })

  it('knocks down 2 to 15 more beyond the reach of the direct shove, counted by the physics as the events show', () => {
    expect(run.scene.crowd.stats.physics.fallsBeyondBlast).toBeGreaterThanOrEqual(2)
    expect(run.scene.crowd.stats.physics.fallsBeyondBlast).toBeLessThanOrEqual(15)
    expect(beyond.length).toBe(run.scene.crowd.stats.physics.fallsBeyondBlast)
  })

  it('the wave travels in time: the chain falls come at least 30 steps after the grenade, later than the direct ones', () => {
    expect(Math.min(...beyond.map((fall) => fall.step - COMPRESS_STEPS))).toBeGreaterThanOrEqual(30)
    expect(median(beyond.map((fall) => fall.step))).toBeGreaterThan(median(direct.map((fall) => fall.step)))
  })

  it('a thrown body knocks down the ones it lands on: at least one fall by landing, never more than 32 flying at once', () => {
    expect(run.scene.crowd.stats.physics.falls[FALL_CAUSE.LANDING - 1]).toBeGreaterThanOrEqual(1)
    expect(run.scene.crowd.stats.physics.thrownPeak).toBeLessThanOrEqual(32)
    expect(run.scene.crowd.thrown.active()).toBe(0)
  })
})

describe('a row of brutes in the same queue', () => {
  it('holds: no brute falls in the row 6.5 to 7 m from the grenade, while at least half of the walkers of the same row fall without them', () => {
    const control = createChainScene({ personality: true })
    const controlRun = runChain(control)
    const row: number[] = []
    // the places of the walkers 6.5 to 7 m from the grenade at the moment it goes off: they are the row that gets the brutes
    const replay = createChainScene()
    runSteps(replay, COMPRESS_STEPS)
    const point = mortarAt(replay.crowd).point
    for (let i = 0; i < replay.crowd.store.n; i++) if (Math.hypot(replay.crowd.store.x[i]! - point[0], replay.crowd.store.z[i]! - point[2]) >= 6.5 && Math.hypot(replay.crowd.store.x[i]! - point[0], replay.crowd.store.z[i]! - point[2]) <= 7) row.push(i)
    expect(row.length).toBeGreaterThan(3)
    const fallenInControl = new Set(controlRun.falls.filter((fall) => fall.cause === FALL_CAUSE.BLAST).map((fall) => fall.agent))
    expect(row.filter((i) => fallenInControl.has(i)).length / row.length).toBeGreaterThanOrEqual(0.5)

    const brutes = new Set(row)
    const withBrutes = runChain(createChainScene({ typeAt: (rowIndex, column) => (brutes.has(rowIndex * 8 + column) ? BRUTE : 0) }))
    expect(withBrutes.falls.filter((fall) => fall.type === BRUTE)).toEqual([])
  })
})

describe('the shared random stream stays where the game left it', () => {
  it('a horde that took a grenade draws the same next number as its twin that did not', () => {
    const hit = createChainScene()
    const twin = createChainScene()
    runSteps(hit, COMPRESS_STEPS)
    runSteps(twin, COMPRESS_STEPS)
    hit.crowd.blast(mortarAt(hit.crowd))
    runSteps(hit, 20)
    runSteps(twin, 20)
    expect(hit.crowd.store.n).toBeLessThan(twin.crowd.store.n)
    expect(hit.crowd.random()).toBe(twin.crowd.random())
  })
})

describe('one pass over the agents', () => {
  it('a blast over 2000 agents makes 2000 checks, two in the same step make 4000', () => {
    const scene = createQueueScene({ columns: 40, rows: 50 })
    expect(scene.crowd.store.n).toBe(2000)
    scene.crowd.blast({ point: [0, 0.3, -3], energy: 1000, radius: 3 })
    scene.crowd.update(1 / 60, scene.context)
    expect(scene.crowd.stats.physics.blastChecks).toBe(2000)
    scene.crowd.blast({ point: [0, 0.3, -3], energy: 1000, radius: 3 })
    scene.crowd.blast({ point: [5, 0.3, -3], energy: 1000, radius: 3 })
    scene.crowd.update(1 / 60, scene.context)
    expect(scene.crowd.stats.physics.blastChecks).toBe(4000)
  })
})
