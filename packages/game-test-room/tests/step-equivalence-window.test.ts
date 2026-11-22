import { buildFrame } from '@adatechnology/game-destruction'
import { createArsenal } from '@adatechnology/game-weapons'
import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import { describe, expect, it } from 'vitest'

import type { BlastCharge } from '@adatechnology/game-destruction'
import type { Scheduler } from '@adatechnology/game-runtime'
import type { PhysicsLoop } from '@adatechnology/game-physics'

import { nonFinitePaths } from '../../../test-support/non-finite'
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

/** A charge with a case: its fragments are cast in the tick of the strike, so they are under the same-bytes guarantee too. */
type CasedStrike = { readonly energy: number; readonly radius: number; readonly charge: BlastCharge }

const casedStrike = (id: string): CasedStrike => {
  const explosive = createArsenal().explosives.get(id)!
  return { energy: explosive.energy, radius: explosive.injuryRadius, charge: { tnt: explosive.tnt!, casing: explosive.casing! } }
}

type SchedulerHolder = { readonly frameParts: { readonly scheduler: Scheduler } }

const stateOf = (room: TestRoom, loop: PhysicsLoop | null): unknown => {
  const pieces = room.renderer.pieces().map((piece) => [piece.objectId, piece.root.position.toArray(), piece.root.quaternion.toArray(), piece.velocity, piece.angularVelocity, piece.sleeping])
  const frame = loop ? [loop.frame.time, loop.frame.steps] : null
  return [room.world.serialize(), pieces, room.fluids.stains(), frame]
}

/** The hash of every tick `0..TICKS-1`, with the frame time `frameTimes` gives: the actions are by tick index, the hash is the state when the tick ends. */
const hashesPerTick = (variant: { readonly loop: PhysicsLoop | null; readonly hasWorkBudget?: boolean; readonly strike?: CasedStrike }, frameTimes: FrameTimes): string[] => {
  const room = makeRoom({ catalog: [...demoItems('en'), SOBRADO], worldOptions: { seed: 7 }, ...(variant.loop ? { physics: variant.loop } : {}), ...(variant.hasWorkBudget ? { debris: { workBudget: { tier: 1 } } } : {}) })
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
      if (tick === STRIKE_TICK) {
        if (variant.strike) room.world.explode([0, 1, -6.4], variant.strike.energy, variant.strike.radius, 'cased', { charge: variant.strike.charge })
        else room.world.explode([0, 1, -6.4], BLAST_JOULES, BLAST_RADIUS, 'c4')
      }
    },
    { phase: 'fixedSimulate', order: FIRST_ORDER, id: 'window-actions' },
  )
  scheduler.add(
    (context) => {
      if (context.tick >= TICKS) return
      const state = stateOf(room, variant.loop)
      // JSON writes NaN as null at every rate, so the hashes alone would match with NaN in the state: a cased run walks the state of every tick for it
      if (variant.strike) {
        const [first] = nonFinitePaths(state, 1, 'state')
        if (first !== undefined) throw new Error(`tick ${context.tick}: not a finite number at ${first}`)
      }
      hashes.push(hashOf(JSON.stringify(state) + sobrado))
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

  // The structural events of a strike apply at the end of the tick that emitted them, on the step pose (spec 017 T2.2), so the hash per tick does not depend on where the frame ends.
  it('the whole run, past the strike: every rate matches the 60 Hz run tick by tick (kit own solver)', () => {
    expectSameAsReference(runOwn(steadyAt(60)), runOwn, TICKS)
  }, 120_000)

  it('the whole run, past the strike: every rate matches the 60 Hz run tick by tick (Jolt loop of 1/120 s steps)', async () => {
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

  // A charge with a case (an M67, a pipe bomb) casts its fragments in the strike's tick: the same bytes per tick at every rate, past the strike
  for (const id of ['m67', 'pipe_bomb']) {
    it(`the whole run with a cased charge (${id}): every rate matches the 60 Hz run tick by tick (kit own solver)`, () => {
      const strike = casedStrike(id)
      const run = (frameTimes: FrameTimes): string[] => hashesPerTick({ loop: null, strike }, frameTimes)
      expectSameAsReference(run(steadyAt(60)), run, TICKS)
    }, 240_000)
  }

  // Pending (spec 017 T2.2, evidence-120hz): under `workBudget` the structural events stay in the frame's drain (the work is paced by frame), so they still read the drawn pose.
  it.fails('with workBudget on, 120 Hz matches the 60 Hz run tick by tick (fails: the workBudget path still applies its events in present, on the drawn pose)', () => {
    const run = (frameTimes: FrameTimes): string[] => hashesPerTick({ loop: null, hasWorkBudget: true }, frameTimes)
    const reference = run(steadyAt(60))
    expect(firstDifferentTick(run(steadyAt(120)), reference)).toBe(-1)
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
