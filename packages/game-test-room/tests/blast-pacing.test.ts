// A blast spread over frames with the world held (`blastPacing`, spec 018 D2) leaves the world of the one-shot blast, and no fixed step runs between it and its damage.
import { describe, expect, it } from 'vitest'

import { makeRoom } from './helpers'
import type { Scheduler } from '@adatechnology/game-runtime'
import type { TestRoom, TestRoomOptions } from '../src'

const TICK = 1 / 60
/** Simulated ticks after which the rooms are compared: past the grenade's fuse and a second more. */
const TICKS = 420

type Run = { readonly state: string; readonly frames: number; readonly frozenFrames: number; readonly backlogInSteps: number; readonly explosions: number; readonly pieces: number }

const fnv = (text: string): number => {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0
  return hash
}

/** Concrete blocks and steel sheets around the spot, a grenade the script sets off (`fire`), then frames of 1/60 s until `TICKS` fixed ticks have run. */
const run = (blastPacing: TestRoomOptions['blastPacing'], fire: (room: TestRoom) => void): Run => {
  const room = makeRoom(blastPacing === undefined ? {} : { blastPacing })
  const explosions: unknown[] = []
  room.loadModule({ id: 'spy', name: 'spy', group: 'spy', items: () => [], attach: (host) => host.on((event) => event.type === 'explosion' && explosions.push(event)) })
  for (const [index, id] of ['concrete_block', 'steel_sheet', 'concrete_block', 'glass_pane', 'steel_sheet'].entries()) room.spawn(id, [(index - 2) * 0.9, 0, -4 - (index % 2) * 0.6], index * 0.4)
  let ticks = 0
  let backlogInSteps = 0
  ;(room as unknown as { readonly frameParts: { readonly scheduler: Scheduler } }).frameParts.scheduler.add(() => {
    ticks++
    backlogInSteps += room.renderer.structuralBacklog()
  }, { phase: 'fixedSimulate', order: -2_000_000, id: 'test.ticks' })
  room.update(TICK)
  fire(room)
  let frames = 0
  let frozenFrames = 0
  while (ticks < TICKS && frames < 2 * TICKS) {
    const before = ticks
    room.update(TICK)
    frames++
    if (ticks === before) frozenFrames++
  }
  return { state: `${fnv(JSON.stringify(room.world.serialize()))}`, frames, frozenFrames, backlogInSteps, explosions: explosions.length, pieces: room.renderer.pieces().length }
}

const throwGrenade = (room: TestRoom): void => {
  room.setTool('frag_grenade')
  for (let i = 0; i < 30; i++) room.update(TICK)
  room.look([0, 1.7, 1], [0, 0.4, -3])
  room.use()
}

const blastAtSpot = (room: TestRoom): void => {
  expect(room.blastAt('m67', [0, 0.4, -3])).toBe(true)
}

describe('blastPacing: a grenade spread over frames (spec 018 D2)', () => {
  it('set off outside a step (blastAt), it leaves the world of the one-shot blast without pacing, frozen frames and all', () => {
    const plain = run(undefined, blastAtSpot)
    const paced = run({ raysPerFrame: 64, unitsPerFrame: 200 }, blastAtSpot)
    expect(plain.explosions).toBe(1)
    expect(paced.explosions).toBe(1)
    expect(plain.frozenFrames).toBe(0)
    expect(paced.frozenFrames).toBeGreaterThan(4)
    expect(paced.state).toBe(plain.state)
    expect(paced.pieces).toBe(plain.pieces)
    expect(paced.backlogInSteps).toBe(0)
  })

  it('set off inside a step (a fuse), it begins at the end of that step: sliced or whole, the same world, and no step runs before its damage is applied', () => {
    const whole = run({ raysPerFrame: Infinity }, throwGrenade)
    for (const pacing of [{ raysPerFrame: 64, unitsPerFrame: 200 }, { raysPerFrame: 7, unitsPerFrame: 1000 }]) {
      const sliced = run(pacing, throwGrenade)
      expect(sliced.explosions).toBe(1)
      expect(sliced.frozenFrames).toBeGreaterThan(2)
      expect(sliced.backlogInSteps).toBe(0)
      expect(sliced.state).toBe(whole.state)
      expect(sliced.pieces).toBe(whole.pieces)
    }
    expect(whole.explosions).toBe(1)
    expect(whole.frozenFrames).toBe(0)
    // the grenade did something: the world without it is another
    expect(run({ raysPerFrame: Infinity }, (room) => room.setTool('frag_grenade')).state).not.toBe(whole.state)
  })
})
