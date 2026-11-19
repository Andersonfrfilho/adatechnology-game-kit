import { describe, expect, it, vi } from 'vitest'

import { checkTaskKind, createWorkerCoordinator, firstDifference, inThreadSpawn } from '@adatechnology/game-workers'
import type { WorkerLike } from '@adatechnology/game-workers'
import { nodeSpawn } from '@adatechnology/game-workers/node'
import { createTerrain } from '@adatechnology/game-terrain'

import { GROUND_CELL, readGround, sampleCount } from '../src/engine-ground'
import { bandLength, computeGroundTile, readGroundBand, readGroundPatch, tileOfResult } from '../src/engine-ground-job'
import type { GroundTileJob, GroundTileResult } from '../src/engine-ground-job'
import { createCoordinatorGroundPort } from '../src/engine-ground-port'
import { GroundSchedule } from '../src/engine-ground-schedule'
import type { PendingGround } from '../src/engine-ground-schedule'
import { groundTilesKind } from '../src/worker-kinds'

const SAMPLES = sampleCount(Math.round(2 / GROUND_CELL))
type Ground = (x: number, z: number) => number

const crater = (): { groundAt: Ground; grid: ReturnType<typeof createTerrain>['heightGrid'] } => {
  const terrain = createTerrain({ bounds: [-6, -6, 6, 6], cellSize: 0.1, layout: { surface: 'dirt' }, baseHeight: (x, z) => 0.04 * Math.sin(2 * x + z) })
  terrain.strike('explosive', { x: 0.37, z: -0.21, energy: 4e6 })
  for (let k = 0; k < 4; k++) terrain.dig({ x: -2.43, z: 1.2, depth: 0.2 })
  return { groundAt: (x, z) => terrain.heightAt(x, z), grid: terrain.heightGrid }
}

/** The job the engine posts for a tile (its samples and band read at the ask). */
const jobOf = (groundAt: Ground, x0: number, z0: number, grid?: ReturnType<typeof createTerrain>['heightGrid'], wasCoarse = false, id = 1): GroundTileJob => {
  const samples = new Float64Array(SAMPLES)
  readGround(groundAt, samples, x0, z0, 2, undefined, grid)
  const band = new Float64Array(bandLength(2)).fill(NaN)
  readGroundBand(groundAt, band, x0, z0, 2, grid)
  return { id, x0, z0, size: 2, wasCoarse, samples, band }
}

const jobs = (): GroundTileJob[] => {
  const { groundAt, grid } = crater()
  const terraces: Ground = (x, z) => 0.15 * Math.floor((x + 0.3 * z) / 0.37)
  return [jobOf(groundAt, 0, -2, grid), jobOf(groundAt, -2, 0, grid, true, 2), jobOf(groundAt, 4, -2, undefined, false, 3), jobOf(terraces, 0, 0, undefined, false, 4), jobOf((x, z) => 0.21 * x - 0.13 * z, 0, 0, undefined, false, 5)]
}

describe('the ground tiles through the worker coordinator (CLAUDE.md §14)', () => {
  it('destruction.ground-tiles gives the same tile, byte for byte, on the main thread, in the in-thread worker and in worker_threads', async () => {
    const report = await checkTaskKind(groundTilesKind, jobs(), [nodeSpawn(new URL('./fixtures/coordinator-worker.mjs', import.meta.url))])
    expect(report.problems).toEqual([])
  }, 60_000)

  it('a patch job (the terrain\'s vertices, not its samples) gives the same tile byte for byte everywhere, and the tile today\'s job gives', async () => {
    const terrain = createTerrain({ bounds: [-6, -6, 6, 6], cellSize: 0.1, layout: { surface: 'dirt' }, baseHeight: (x, z) => 0.04 * Math.sin(2 * x + z) })
    terrain.strike('explosive', { x: 0.37, z: -0.21, energy: 4e6 })
    for (let k = 0; k < 4; k++) terrain.dig({ x: -2.43, z: 1.2, depth: 0.2 })
    const groundAt: Ground = (x, z) => terrain.heightAt(x, z)
    const patchJobs = ([[0, -2], [-2, 0], [2, 0]] as const).map(([x0, z0], k): GroundTileJob => ({
      id: k + 1, x0, z0, size: 2, wasCoarse: k === 1, samples: new Float64Array(0), band: new Float64Array(0), patch: readGroundPatch(terrain.heightPatch, x0, z0, 2)!,
    }))
    for (const job of patchJobs) expect(firstDifference(tileOfResult(computeGroundTile(job), null), tileOfResult(computeGroundTile(jobOf(groundAt, job.x0, job.z0, terrain.heightGrid, job.wasCoarse, job.id)), null))).toBeNull()
    const report = await checkTaskKind(groundTilesKind, patchJobs, [nodeSpawn(new URL('./fixtures/coordinator-worker.mjs', import.meta.url))])
    expect(report.problems).toEqual([])
  }, 60_000)

  it('the port hands each answer to the engine; with no workers it posts nothing and the engine makes every tile at its update', async () => {
    vi.useFakeTimers()
    try {
      const workers = createWorkerCoordinator({ spawn: inThreadSpawn([groundTilesKind]), workers: 2 })
      const port = createCoordinatorGroundPort(workers)
      expect(port.transport).toBe('transfer')
      const answers: GroundTileResult[] = []
      port.onTile((result) => answers.push(result))
      const posted = jobs()
      const expected = jobs().map(computeGroundTile)
      for (const job of posted) port.postTile(job)
      await vi.advanceTimersByTimeAsync(50)
      expect(answers.map((a) => a.id).sort()).toEqual(expected.map((e) => e.id).sort())
      for (const answer of answers) expect(firstDifference(answer, expected.find((e) => e.id === answer.id))).toBeNull()
      expect(workers.stats().kinds.find((k) => k.id === 'destruction.ground-tiles')).toMatchObject({ submitted: posted.length, answered: posted.length, fallback: 0 })
      // a disposed port lets the late answers go
      port.postTile(jobs()[0]!)
      port.dispose()
      await vi.advanceTimersByTimeAsync(20)
      expect(answers.length).toBe(posted.length)
      workers.dispose()

      const none = createWorkerCoordinator({ workers: 0 })
      const idle = createCoordinatorGroundPort(none)
      expect(idle.transport).toBe('none')
      idle.onTile(() => answers.push(null as unknown as GroundTileResult))
      idle.postTile(jobs()[0]!)
      await vi.advanceTimersByTimeAsync(20)
      expect(none.stats().kinds.length === 0 || none.stats().kinds.every((k) => k.submitted === 0)).toBe(true)
      expect(answers.length).toBe(posted.length)
    } finally {
      vi.useRealTimers()
    }
  })

  it('a worker that dies holding ground jobs: those tiles are made here at their update, to the bit; the next ones still go to the (replaced) worker', async () => {
    vi.useFakeTimers()
    try {
      const spawned: WorkerLike[] = []
      const inner = inThreadSpawn([groundTilesKind], { delayMs: 20 })
      const workers = createWorkerCoordinator({ spawn: () => spawned[spawned.push(inner()) - 1]!, workers: 1 })
      const port = createCoordinatorGroundPort(workers)
      const schedule = new GroundSchedule(port, 2)
      const askAll = (now: number): GroundTileJob[] => {
        const list = jobs()
        list.forEach((job, key) => {
          const band = schedule.band(job.size)
          band.set(job.band)
          schedule.ask({ key, ix: 0, iz: 0, x0: job.x0, z0: job.z0, size: job.size, fresh: true, wasCoarse: job.wasCoarse, samples: job.samples }, band, now)
        })
        return list
      }
      const due: PendingGround[] = []
      const applied = (asked: GroundTileJob[], now: number): void => {
        schedule.takeDue(now, due)
        expect(due.length).toBe(asked.length)
        due.forEach((p, i) => {
          const expected = tileOfResult(computeGroundTile({ ...asked[i]!, samples: Float64Array.from(asked[i]!.samples), band: Float64Array.from(asked[i]!.band) }), p.samples)
          expect(firstDifference(schedule.resolve(p), expected)).toBeNull()
        })
      }

      const lost = askAll(0)
      spawned[0]!.onerror?.(new Error('killed'))
      await vi.advanceTimersByTimeAsync(0)
      expect(port.transport).toBe('transfer')
      applied(lost, 2)
      expect(schedule.stats).toMatchObject({ inTime: 0, fellBack: lost.length })
      expect(workers.stats().kinds.find((k) => k.id === 'destruction.ground-tiles')).toMatchObject({ failed: lost.length, fallback: 0 })

      const next = askAll(10)
      await vi.advanceTimersByTimeAsync(20)
      applied(next, 12)
      expect(schedule.stats).toMatchObject({ inTime: next.length, fellBack: lost.length })
      schedule.dispose()
      workers.dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  it('patch jobs through the coordinator: transferred, the main thread keeps its own patch; lost with a dying worker they are made here at their update, to the bit', async () => {
    vi.useFakeTimers()
    try {
      const terrain = createTerrain({ bounds: [-6, -6, 6, 6], cellSize: 0.1, layout: { surface: 'dirt' } })
      terrain.strike('explosive', { x: 0.37, z: -0.21, energy: 4e6 })
      const spawned: WorkerLike[] = []
      const inner = inThreadSpawn([groundTilesKind], { delayMs: 20 })
      const workers = createWorkerCoordinator({ spawn: () => spawned[spawned.push(inner()) - 1]!, workers: 1 })
      const schedule = new GroundSchedule(createCoordinatorGroundPort(workers), 2)
      const tiles = [[0, -2], [-2, 0], [0, 0]] as const
      const expected = tiles.map(([x0, z0]) => tileOfResult(computeGroundTile(jobOf((x, z) => terrain.heightAt(x, z), x0, z0, terrain.heightGrid)), null))
      const askAll = (now: number): void => tiles.forEach(([x0, z0], key) => {
        const patch = schedule.readPatch(terrain.heightPatch, x0, z0, 2)!
        schedule.ask({ key, ix: 0, iz: 0, x0, z0, size: 2, fresh: true, wasCoarse: false, samples: null, patch }, null, now)
      })
      const due: PendingGround[] = []
      const applied = (now: number): void => {
        schedule.takeDue(now, due)
        expect(due.length).toBe(tiles.length)
        due.forEach((p, i) => {
          const tile = schedule.resolve(p)
          expect(tile.patch).toBe(p.patch)
          expect(firstDifference({ ...tile, patch: undefined }, { ...expected[i]!, patch: undefined })).toBeNull()
          schedule.givePatch(p.patch!.heights)
        })
      }
      askAll(0)
      spawned[0]!.onerror?.(new Error('killed'))
      await vi.advanceTimersByTimeAsync(0)
      applied(2)
      expect(schedule.stats).toMatchObject({ inTime: 0, fellBack: tiles.length })
      askAll(10)
      await vi.advanceTimersByTimeAsync(20)
      applied(12)
      expect(schedule.stats).toMatchObject({ inTime: tiles.length, fellBack: tiles.length })
      // the copies the dead worker held never come back (the pool makes new ones); every other one did
      expect(schedule.outstanding).toBe(tiles.length)
      schedule.dispose()
      workers.dispose()
    } finally {
      vi.useRealTimers()
    }
  })
})
