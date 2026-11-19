import { buildFrame } from '@adatechnology/game-destruction'
import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import { describe, expect, it } from 'vitest'

import type { Scheduler } from '@adatechnology/game-runtime'
import type { PhysicsLoop } from '@adatechnology/game-physics'

import { buildFromSpec } from '../src/build-from-spec'
import type { TestRoom, TestRoomItem } from '../src'
import { demoItems } from './fixtures/demo-items'
import { makeRoom } from './helpers'

// Spec 017 T1.2 (criterion C4): the same scene gives the same bytes per scheduler tick whatever the frame time is. The room is driven the way a display does (`update(dt, { live: true })`:
// the accumulator, the carried remainder, the frame cap), the actions fire inside the fixedSimulate phase by tick index, and the hash is taken at the end of each tick.
// No player input: what the `input` phase does to the physics still integrates with the frame dt (rule 15, "Ainda fora do passo fixo").
const TICKS = 120
const STRIKE_TICK = 30
const BLAST_JOULES = 4_000_000
const BLAST_RADIUS = 14
const FIRST_ORDER = -1_000_000
const LAST_ORDER = 1_000_000
const MAX_FRAMES = 4_000

const sobradoSpec = () => ({ ...buildFrame({ spanX: 6, spanZ: 5, columnsX: 3, columnsZ: 2, height: 2.7, floors: 2, walls: true, roof: true }), name: 'sobrado' })
const SOBRADO: TestRoomItem = { id: 'sobrado', name: 'Sobrado', group: 'structure', spec: sobradoSpec(), movable: false, build: (T) => buildFromSpec(T, sobradoSpec()) }

/** cyrb53: a 53-bit string hash, plenty to tell two ticks apart. */
const hashOf = (text: string): string => {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)
}

/** mulberry32: a seeded generator, so "random frame time" is the same sequence on every run. */
const seededRandom = (seed: number): (() => number) => {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

type FrameTimes = (frame: number) => number

const steadyAt = (hertz: number): FrameTimes => () => 1 / hertz
// 0.6x to 1.4x of the nominal frame: at 30 Hz the longest frame (0.047 s) stays under the 0.05 s cap of the scheduler
const jitteredAt = (hertz: number, seed: number): FrameTimes => {
  const next = seededRandom(seed)
  return () => (0.6 + 0.8 * next()) / hertz
}

type SchedulerHolder = { readonly frameParts: { readonly scheduler: Scheduler } }

const stateOf = (room: TestRoom, loop: PhysicsLoop | null): string => {
  const pieces = room.renderer.pieces().map((piece) => [piece.objectId, piece.root.position.toArray(), piece.root.quaternion.toArray(), piece.velocity, piece.angularVelocity, piece.sleeping])
  const frame = loop ? [loop.frame.time, loop.frame.steps] : null
  return JSON.stringify([room.world.serialize(), pieces, room.fluids.stains(), frame])
}

/** The hash of every tick `0..TICKS-1`, with the frame time `frameTimes` gives: the actions are by tick index, the hash is the state when the tick ends. */
const hashesPerTick = (variant: { readonly loop: PhysicsLoop | null }, frameTimes: FrameTimes): string[] => {
  const room = makeRoom({ catalog: [...demoItems('en'), SOBRADO], worldOptions: { seed: 7 }, ...(variant.loop ? { physics: variant.loop } : {}) })
  const { scheduler } = (room as unknown as SchedulerHolder).frameParts
  const sobrado = room.spawn('sobrado', [0, 0, -9]).objectId
  const hashes: string[] = []
  let crate = ''
  scheduler.add(
    (context) => {
      const tick = context.tick
      if (tick === 10) {
        crate = room.spawn('wooden_crate', [4, 0, -5]).objectId
        room.fluids.splash('fuel', [4.6, 0.02, -5], 0.5)
        room.fluids.splash('water', [-3, 0.02, -4], 0.4)
      }
      if (tick >= 20 && tick < 60 && tick % 5 === 0) room.world.hit(crate, { type: 'fire', point: [4, 0.4, -5], temperature: 900, radius: 0.8, duration: 2, source: 'fire' })
      if (tick === STRIKE_TICK) room.world.explode([0, 1, -6.4], BLAST_JOULES, BLAST_RADIUS, 'c4')
    },
    { phase: 'fixedSimulate', order: FIRST_ORDER, id: 'window-actions' },
  )
  scheduler.add(
    (context) => {
      if (context.tick < TICKS) hashes.push(hashOf(stateOf(room, variant.loop) + sobrado))
    },
    { phase: 'fixedSimulate', order: LAST_ORDER, id: 'window-hash' },
  )
  for (let frame = 0; frame < MAX_FRAMES && hashes.length < TICKS; frame++) room.update(frameTimes(frame), { live: true })
  room.dispose()
  return hashes
}

const firstDifferentTick = (actual: readonly string[], expected: readonly string[]): number => expected.findIndex((hash, tick) => actual[tick] !== hash)

const RATES = [30, 60, 120, 144] as const
const RUNS: readonly (readonly [string, FrameTimes])[] = [
  ...RATES.filter((hertz) => hertz !== 60).map((hertz): readonly [string, FrameTimes] => [`${hertz} Hz`, steadyAt(hertz)]),
  ['random around 30 Hz', jitteredAt(30, 11)],
  ['random around 60 Hz', jitteredAt(60, 17)],
  ['random around 144 Hz', jitteredAt(144, 23)],
]

const expectSameAsReference = (reference: readonly string[], run: (frameTimes: FrameTimes) => string[], upToTick: number): void => {
  expect(reference).toHaveLength(TICKS)
  for (const [label, frameTimes] of RUNS) {
    const hashes = run(frameTimes)
    expect({ label, firstDifferent: firstDifferentTick(hashes.slice(0, upToTick), reference.slice(0, upToTick)) }).toEqual({ label, firstDifferent: -1 })
  }
}

const runOwn = (frameTimes: FrameTimes): string[] => hashesPerTick({ loop: null }, frameTimes)

describe('the same scene gives the same bytes per tick at any frame rate (spec 017 C4)', () => {
  // Measured on `fa36c042e`: with the strike at tick 30 the hash is the same at every rate up to and including tick 30 (spawn, fuel and water, fire, the strike itself), and it differs from tick 31 on.
  it('up to the tick of the strike: 30, 120 and 144 Hz and seeded random frame times match the 60 Hz run (kit own solver)', () => {
    const reference = runOwn(steadyAt(60))
    expect(new Set(reference).size).toBeGreaterThan(60)
    expectSameAsReference(reference, runOwn, STRIKE_TICK + 1)
  }, 120_000)

  // Expected failure, closed by the explosion window (phases 2 and 3 of spec 017): the events of a strike apply in `present`, after the LAST tick of the frame that holds it. At 30 Hz (2 ticks a frame)
  // tick 31 still runs with the scene as it was before the blast (1 piece, 15 after the drain); at 120 Hz the pieces are there at tick 31 but with other poses and a different world state.
  // Everything after tick 31 follows from it. Drop `.fails` when the window makes the hash per tick independent of where the frame ends.
  it.fails('the whole run, past the strike: every rate matches the 60 Hz run tick by tick (kit own solver)', () => {
    expectSameAsReference(runOwn(steadyAt(60)), runOwn, TICKS)
  }, 120_000)

  // Expected failure, same cause as above, on the Jolt loop (30 Hz differs from tick 31 on).
  it.fails('the whole run, past the strike: every rate matches the 60 Hz run tick by tick (Jolt loop of 1/120 s steps)', async () => {
    const engine = await createJoltEngine()
    const run = (frameTimes: FrameTimes): string[] => {
      const world = engine.createWorld({ ...KIT_WORLD })
      try {
        return hashesPerTick({ loop: createPhysicsLoop(world) }, frameTimes)
      } finally {
        world.dispose()
      }
    }
    expectSameAsReference(run(steadyAt(60)), run, TICKS)
  }, 120_000)

  it('up to the tick of the strike on the Jolt loop: the same runs match', async () => {
    const engine = await createJoltEngine()
    const run = (frameTimes: FrameTimes): string[] => {
      const world = engine.createWorld({ ...KIT_WORLD })
      try {
        return hashesPerTick({ loop: createPhysicsLoop(world) }, frameTimes)
      } finally {
        world.dispose()
      }
    }
    expectSameAsReference(run(steadyAt(60)), run, STRIKE_TICK + 1)
  }, 120_000)
})
