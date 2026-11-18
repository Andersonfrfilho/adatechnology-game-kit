import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { CommandRing, SnapshotReader, SnapshotWriter, createCommandBuffer, createSnapshotBuffer, runSimInline, startSimThread } from '../src'
import { nodeSpawn } from '../src/node'
// @ts-expect-error plain JS fixture of the built package
import { STATE, field } from './fixtures/sim.mjs'

const BYTES = (STATE as number) * 8
const commands = (frame: number): number[][] => (frame % 7 === 0 ? [[frame, frame * 0.5]] : [])

describe('shared memory', () => {
  it('the reader always gets the newest whole snapshot and never a slot the writer is filling', () => {
    const buffer = createSnapshotBuffer(16)
    const writer = new SnapshotWriter(buffer)
    const reader = new SnapshotReader(buffer)
    expect(reader.latest()).toBeNull()
    for (let frame = 0; frame < 50; frame++) {
      const held = reader.latest()
      const out = writer.begin()
      if (held) expect(out.byteOffset).not.toBe(held.byteOffset)
      out.fill(frame)
      writer.commit(frame)
      if (held) expect([...held.bytes]).toEqual(Array(held.byteLength).fill(held.frame))
      const now = reader.latest()!
      expect(now.frame).toBe(frame)
      expect(now.bytes[0]).toBe(frame)
    }
  })

  it('the ring hands the commands over in order and refuses one when full', () => {
    const ring = new CommandRing(createCommandBuffer(3, 4))
    for (let k = 0; k < 4; k++) expect(ring.push([k, k * 2])).toBe(true)
    expect(ring.push([9])).toBe(false)
    expect(ring.drain().map((c) => [...c])).toEqual([0, 1, 2, 3].map((k) => [k, k * 2, 0]))
    expect(ring.push([5, 5, 5])).toBe(true)
    expect(ring.drain().map((c) => [...c])).toEqual([[5, 5, 5]])
    expect(() => ring.push([1, 2, 3, 4])).toThrow()
  })
})

describe('simulation thread', () => {
  const script = fileURLToPath(new URL('./fixtures/sim-worker.mjs', import.meta.url))

  it('gives the same bytes as the inline loop, with the jobs in workers it waits for', async () => {
    const steps = 40
    const inline = await runSimInline(field, { seed: 11, worker: false }, { steps, snapshotBytes: BYTES, commands: Array.from({ length: steps }, (_, f) => commands(f)) })
    const withWorkers = await runSimInline(field, { seed: 11, worker: true }, { steps, snapshotBytes: BYTES, commands: Array.from({ length: steps }, (_, f) => commands(f)) })
    expect(Buffer.from(withWorkers).equals(Buffer.from(inline))).toBe(true)

    // in its own thread, unpaced, the commands of frame 0 queued before the start
    const sim = startSimThread(nodeSpawn(script), { module: 'test.field', init: { seed: 11, worker: true }, snapshotBytes: BYTES, steps: 1, paced: false })
    for (const c of commands(0)) sim.send(c)
    await sim.ready
    expect(await sim.done).toBe(1)
    const one = await runSimInline(field, { seed: 11, worker: false }, { steps: 1, snapshotBytes: BYTES, commands: [commands(0)] })
    expect(Buffer.from(sim.latest()!.bytes).equals(Buffer.from(one))).toBe(true)
    sim.dispose()

    const long = startSimThread(nodeSpawn(script), { module: 'test.field', init: { seed: 11, worker: true }, snapshotBytes: BYTES, steps, paced: false })
    await long.ready
    expect(await long.done).toBe(steps)
    const plain = await runSimInline(field, { seed: 11, worker: false }, { steps, snapshotBytes: BYTES })
    const snapshot = long.latest()!
    expect(snapshot.frame).toBe(steps - 1)
    expect(Buffer.from(snapshot.bytes).equals(Buffer.from(plain))).toBe(true)
    expect(long.stats().steps).toBe(steps)
    long.dispose()
  }, 30_000)

  it('paces the steps on the clock, sleeping in the thread, and stops when asked', async () => {
    const sim = startSimThread(nodeSpawn(script), { module: 'test.field', init: { seed: 3, worker: false }, snapshotBytes: BYTES, stepSeconds: 1 / 100 })
    await sim.ready
    const started = performance.now()
    await new Promise((r) => setTimeout(r, 300))
    sim.stop()
    const steps = await sim.done
    const elapsed = performance.now() - started
    // about 100 a second: neither as fast as it computes nor stalled
    expect(steps).toBeGreaterThan(elapsed / 10 - 15)
    expect(steps).toBeLessThan(elapsed / 10 + 15)
    expect(sim.latest()!.frame).toBe(steps - 1)
    sim.dispose()
  }, 30_000)

  it('rejects a module the thread does not have', async () => {
    const sim = startSimThread(nodeSpawn(script), { module: 'test.nothing', init: {}, snapshotBytes: 8 })
    await expect(sim.ready).rejects.toThrow(/no module test.nothing/)
    sim.dispose()
  })
})
