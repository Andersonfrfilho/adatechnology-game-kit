import { describe, it } from 'vitest'

import { createWorkerCoordinator } from '@adatechnology/game-workers'
import { nodeSpawn } from '@adatechnology/game-workers/node'
import { createTerrain } from '@adatechnology/game-terrain'

import { GROUND_CELL, readGround, sampleCount } from '../src/engine-ground'
import { readGroundBand } from '../src/engine-ground-job'
import type { GroundTileJob } from '../src/engine-ground-job'
import { createCoordinatorGroundPort } from '../src/engine-ground-port'
import type { GroundWorkerPort } from '../src/engine-ground-port'
import { GroundSchedule } from '../src/engine-ground-schedule'

/**
 * What the engine's `askTile` costs on the main thread in a blast's worst frame, split by part: the terrain read (`readGround`, `readGroundBand`), the copy into the schedule's
 * pool, the coordinator's `run` (posting the job to a `worker_threads` worker) and the port's `stats()` reads. A crater dug in a terrain like the room's, every 2 m tile over it
 * asked in one go, as a blast does. Off unless GROUND_BENCH=1 (it prints and times: no gate): `GROUND_BENCH=1 vitest run tests/engine-ground-ask.bench.test.ts`.
 */
const TILE = 2
const SIDE = 12
const ROUNDS = 7
const SAMPLES = sampleCount(Math.round(TILE / GROUND_CELL))

const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!

const craterTerrain = () => {
  const half = (SIDE * TILE) / 2 + 2
  const terrain = createTerrain({ bounds: [-half, -half, half, half], cellSize: 0.1, layout: { surface: 'dirt' }, baseHeight: (x, z) => 0.04 * Math.sin(2 * x + z) })
  terrain.strike('explosive', { x: 0.37, z: -0.21, energy: 4e7 })
  for (let k = 0; k < 4; k++) terrain.dig({ x: -2.43, z: 1.2, depth: 0.2 })
  return terrain
}

interface Split {
  read: number
  band: number
  ask: number
  post: number
  transport: number
}

/** The port, its calls timed into `split` (the time `ask` spends outside them is the pool copy). */
const timed = (port: GroundWorkerPort, split: Split): GroundWorkerPort => ({
  get transport() {
    const started = performance.now()
    const t = port.transport
    split.transport += performance.now() - started
    return t
  },
  postTile: (job: GroundTileJob) => {
    const started = performance.now()
    port.postTile(job)
    split.post += performance.now() - started
  },
  onTile: (handler) => port.onTile(handler),
  dispose: () => port.dispose(),
})

describe.skipIf(process.env.GROUND_BENCH !== '1')('asking for a blast of ground tiles on the main thread (bench)', () => {
  it.each(['samples', 'patch'] as const)(`${SIDE * SIDE} tiles of ${TILE} m over a crater, through the coordinator (4 worker_threads), asked with %s`, async (mode) => {
    const terrain = craterTerrain()
    const groundAt = (x: number, z: number): number => terrain.heightAt(x, z)
    const workers = createWorkerCoordinator({ spawn: nodeSpawn(new URL('./fixtures/coordinator-worker.mjs', import.meta.url)), workers: 4 })
    const rows: Record<keyof Split | 'stats' | 'total', number>[] = []
    const split: Split = { read: 0, band: 0, ask: 0, post: 0, transport: 0 }
    // one schedule for every blast, as the engine keeps it: its pool is warm after the first
    const schedule = new GroundSchedule(timed(createCoordinatorGroundPort(workers), split), 2)
    const due: Parameters<GroundSchedule['takeDue']>[1] = []
    for (let round = 0; round < ROUNDS; round++) {
      Object.assign(split, { read: 0, band: 0, ask: 0, post: 0, transport: 0 })
      const started = performance.now()
      let key = 0
      for (let ix = -SIDE / 2; ix < SIDE / 2; ix++) {
        for (let iz = -SIDE / 2; iz < SIDE / 2; iz++) {
          const x0 = ix * TILE
          const z0 = iz * TILE
          let t = performance.now()
          if (mode === 'patch') {
            // the engine's `askPatch`: the vertices under the tile and its ring, sent instead of the samples and band
            const patch = schedule.readPatch(terrain.heightPatch, x0, z0, TILE)!
            split.read += performance.now() - t
            t = performance.now()
            schedule.ask({ key: key++, ix, iz, x0, z0, size: TILE, fresh: true, wasCoarse: false, samples: null, patch }, null, round * 10)
            split.ask += performance.now() - t
            continue
          }
          const samples = new Float64Array(SAMPLES)
          readGround(groundAt, samples, x0, z0, TILE, undefined, terrain.heightGrid)
          split.read += performance.now() - t
          t = performance.now()
          const band = schedule.band(TILE)
          readGroundBand(groundAt, band, x0, z0, TILE, terrain.heightGrid)
          split.band += performance.now() - t
          t = performance.now()
          schedule.ask({ key: key++, ix, iz, x0, z0, size: TILE, fresh: true, wasCoarse: false, samples }, band, round * 10)
          split.ask += performance.now() - t
        }
      }
      const total = performance.now() - started
      let t = performance.now()
      for (let k = 0; k < SIDE * SIDE * 2; k++) workers.stats()
      const stats = performance.now() - t
      rows.push({ ...split, ask: split.ask - split.post - split.transport, stats, total })
      // every answer back before the next round (the next blast)
      t = performance.now()
      while ([...schedule.pending.values()].some((p) => !p.result) && performance.now() - t < 20_000) await new Promise((resolve) => setTimeout(resolve, 5))
      schedule.takeDue(round * 10 + 2, due)
      for (const p of due) {
        schedule.resolve(p)
        if (p.patch) schedule.givePatch(p.patch.heights)
      }
    }
    console.log(`  in time ${schedule.stats.inTime}, fell back ${schedule.stats.fellBack}, pooled ${schedule.pooled}`)
    schedule.dispose()
    workers.dispose()
    const keys = ['read', 'band', 'ask', 'post', 'transport', 'stats', 'total'] as const
    const labels = { read: mode === 'patch' ? 'readPatch' : 'readGround', band: 'readGroundBand', ask: 'pool copy', post: 'coordinator.run', transport: 'transport (stats)', stats: `${SIDE * SIDE * 2} stats()`, total: 'askTile total' }
    console.log(`ground ask (${mode}), ${SIDE * SIDE} tiles, median of ${ROUNDS} rounds (first is cold):`)
    for (const k of keys) console.log(`  ${labels[k].padEnd(20)} ${median(rows.slice(1).map((r) => r[k])).toFixed(2)} ms   (cold ${rows[0]![k].toFixed(2)} ms)`)
  }, 120_000)
})
