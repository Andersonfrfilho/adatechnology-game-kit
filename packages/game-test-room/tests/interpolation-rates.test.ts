import { buildFrame } from '@adatechnology/game-destruction'
import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import { describe, expect, it } from 'vitest'

import type { PhysicsLoop } from '@adatechnology/game-physics'

import { buildFromSpec } from '../src/build-from-spec'
import type { TestRoom, TestRoomItem } from '../src'
import { demoItems } from './fixtures/demo-items'
import { makeRoom } from './helpers'

// Spec 010 T3.6 (C5): the display rate changes what is drawn between two ticks, never what a tick computes.
const TICKS = 60
const WARM_UP_FRAMES = 90
const RATES = [60, 120, 144] as const
const BLAST_JOULES = 4_000_000
const BLAST_RADIUS = 14

const sobradoSpec = () => ({ ...buildFrame({ spanX: 6, spanZ: 5, columnsX: 3, columnsZ: 2, height: 2.7, floors: 2, walls: true, roof: true }), name: 'sobrado' })
const SOBRADO: TestRoomItem = { id: 'sobrado', name: 'Sobrado', group: 'structure', spec: sobradoSpec(), movable: false, build: (T) => buildFromSpec(T, sobradoSpec()) }

const stateOf = (room: TestRoom, loop: PhysicsLoop | null): string => {
  const pieces = room.renderer.pieces().map((piece) => [piece.objectId, piece.root.position.toArray(), piece.root.quaternion.toArray(), piece.velocity, piece.angularVelocity, piece.sleeping])
  return JSON.stringify([room.world.serialize(), pieces, room.fluids.stains(), loop ? [loop.frame.time, loop.frame.steps] : null])
}

/** The state after each tick, by tick number, from live frames at `rate` Hz. */
const ticksAt = (rate: number, makeOne: () => { room: TestRoom; loop: PhysicsLoop | null }): { hashes: Map<number, string>; wasDrawnBetween: boolean } => {
  const { room, loop } = makeOne()
  room.spawn('sobrado', [0, 0, -9])
  room.world.explode([0, 1, -6.4], BLAST_JOULES, BLAST_RADIUS, 'c4')
  // the events of the blast drain by the frame's budget, so they land at a tick that depends on the rate: let them settle at the tick rate first
  for (let frame = 0; frame < WARM_UP_FRAMES; frame++) room.update(1 / 60)
  const hashes = new Map<number, string>()
  let wasDrawnBetween = false
  const firstTick = (room.frameStats?.().tick ?? 0)
  let previousTick = firstTick
  for (let frame = 0; frame < TICKS * 4 && previousTick < firstTick + TICKS; frame++) {
    room.update(1 / rate, { live: true })
    const tick = (room.frameStats?.().tick ?? 0)
    const drawn = room.renderer.pieces().map((piece) => piece.root.position.toArray().join())
    room.renderer.restoreStepPose()
    const stepPose = room.renderer.pieces().map((piece) => piece.root.position.toArray().join())
    if (rate > 60 && drawn.some((pose, index) => pose !== stepPose[index])) wasDrawnBetween = true
    if (tick === previousTick + 1) hashes.set(tick - firstTick, stateOf(room, loop))
    previousTick = tick
  }
  return { hashes, wasDrawnBetween }
}

const expectSameTicks = (runs: ReturnType<typeof ticksAt>[]): void => {
  const [reference, ...others] = runs
  expect(reference?.hashes.size).toBeGreaterThan(TICKS / 2)
  expect(new Set(reference?.hashes.values()).size).toBeGreaterThan(TICKS / 3)
  for (const other of others) {
    const common = [...(reference?.hashes.keys() ?? [])].filter((tick) => other.hashes.has(tick))
    expect(common.length).toBeGreaterThan(TICKS / 2)
    expect(common.filter((tick) => other.hashes.get(tick) !== reference?.hashes.get(tick))).toEqual([])
  }
  expect(runs.slice(1).every((run) => run.wasDrawnBetween)).toBe(true)
}

describe('the same scene gives the same state per tick at 60, 120 and 144 Hz (spec 010 T3.6, C5)', () => {
  it('on the kit own solver: a 4 MJ blast on the sobrado', () => {
    const runs = RATES.map((rate) => ticksAt(rate, () => ({ room: makeRoom({ catalog: [...demoItems('en'), SOBRADO], worldOptions: { seed: 7 }, physics: 'own' }), loop: null })))
    expectSameTicks(runs)
  })

  it('on a Jolt physics loop: the same scene', async () => {
    const engine = await createJoltEngine()
    const runs = RATES.map((rate) =>
      ticksAt(rate, () => {
        const loop = createPhysicsLoop(engine.createWorld({ ...KIT_WORLD }))
        return { room: makeRoom({ catalog: [...demoItems('en'), SOBRADO], worldOptions: { seed: 7 }, physics: loop }), loop }
      }),
    )
    expectSameTicks(runs)
  })
})
