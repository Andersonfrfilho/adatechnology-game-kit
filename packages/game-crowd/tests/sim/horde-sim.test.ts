import { describe, expect, it } from 'vitest'

import { runSimInline, startSimThread } from '@adatechnology/game-workers'
import { nodeSpawn } from '@adatechnology/game-workers/node'

import { HORDE_COMMAND, createStore, hordeSimModule, hordeSnapshotBytes, readHordeSnapshot } from '../../src'
import type { HordeSimInit } from '../../src'
import { packWithBalance, physicsOptions } from '../physics/scenes'

const WORKER_FILE = new URL('../fixtures/node-sim-worker.mjs', import.meta.url)
const CAPACITY = 900
const init: HordeSimInit = { pack: packWithBalance(), seed: 17, capacity: CAPACITY, physics: physicsOptions(), count: 400, spawn: { x: 0, z: -30, radius: 14 }, target: { x: 0, z: 0 } }
const STEPS = 120
const BYTES = hordeSnapshotBytes(CAPACITY)
/** What the page sends before the first step: the target a little aside, and a blast in the middle of the horde. */
const START = [
  [HORDE_COMMAND.TARGET, 4, 2, 0.5, 1],
  [HORDE_COMMAND.BLAST, 0, 0.5, -30, 6, 400000],
]

describe('the horde in the simulation thread', () => {
  it('moves the same, byte for byte, in its own thread as in the inline loop', async () => {
    const reference = await runSimInline(hordeSimModule, init, { steps: STEPS, snapshotBytes: BYTES, commands: [START] })
    const store = createStore(CAPACITY)
    const header = readHordeSnapshot(store, reference)
    expect(header.frame).toBe(STEPS - 1)
    expect(header.n).toBeGreaterThan(300)
    // the blast threw or felled some, and the horde closed in on the target
    const meanZ = Array.from(store.z.subarray(0, store.n)).reduce((a, b) => a + b, 0) / store.n
    expect(meanZ).toBeGreaterThan(-30)

    const sim = startSimThread(nodeSpawn(WORKER_FILE), { module: hordeSimModule.id, init, snapshotBytes: BYTES, paced: false, steps: STEPS })
    for (const c of START) expect(sim.send(c)).toBe(true)
    await sim.ready
    expect(await sim.done).toBe(STEPS)
    const snapshot = sim.latest()!
    expect(snapshot.frame).toBe(STEPS - 1)
    expect(Buffer.from(snapshot.bytes).equals(Buffer.from(reference))).toBe(true)
    sim.dispose()
  }, 60_000)

  it('the page store read from a snapshot draws the same agents as the store that wrote it', async () => {
    const commands = Array.from({ length: 30 }, (_, f) => [[HORDE_COMMAND.TARGET, Math.cos(f / 9) * 5, Math.sin(f / 9) * 5, f / 9, 1]])
    const a = await runSimInline(hordeSimModule, init, { steps: 30, snapshotBytes: BYTES, commands })
    const b = await runSimInline(hordeSimModule, init, { steps: 30, snapshotBytes: BYTES, commands })
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
    const store = createStore(CAPACITY)
    readHordeSnapshot(store, a)
    expect(Number.isFinite(store.x[0])).toBe(true)
    expect(store.x.subarray(store.n).every((v) => v === 0)).toBe(true)
  }, 60_000)
})
