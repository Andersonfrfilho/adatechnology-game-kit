import { describe, expect, it } from 'vitest'

import { checkTaskKind, createWorkerCoordinator, firstDifference, inThreadSpawn } from '@adatechnology/game-workers'
import { nodeSpawn } from '@adatechnology/game-workers/node'
import { createTerrain } from '@adatechnology/game-terrain'

import { GROUND_CELL, readGround, sampleCount } from '../src/engine-ground'
import { bandLength, computeGroundTile, readGroundBand } from '../src/engine-ground-job'
import type { GroundTileJob, GroundTileResult } from '../src/engine-ground-job'
import { createCoordinatorGroundPort } from '../src/engine-ground-port'
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

  it('the port hands each answer to the engine; with no workers it posts nothing and the engine makes every tile at its update', async () => {
    const workers = createWorkerCoordinator({ spawn: inThreadSpawn([groundTilesKind]), workers: 2 })
    const port = createCoordinatorGroundPort(workers)
    expect(port.transport).toBe('transfer')
    const answers: GroundTileResult[] = []
    port.onTile((result) => answers.push(result))
    const posted = jobs()
    const expected = jobs().map(computeGroundTile)
    for (const job of posted) port.postTile(job)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(answers.map((a) => a.id).sort()).toEqual(expected.map((e) => e.id).sort())
    for (const answer of answers) expect(firstDifference(answer, expected.find((e) => e.id === answer.id))).toBeNull()
    expect(workers.stats().kinds.find((k) => k.id === 'destruction.ground-tiles')).toMatchObject({ submitted: posted.length, answered: posted.length, fallback: 0 })
    // a disposed port lets the late answers go
    port.postTile(jobs()[0]!)
    port.dispose()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(answers.length).toBe(posted.length)
    workers.dispose()

    const none = createWorkerCoordinator({ workers: 0 })
    const idle = createCoordinatorGroundPort(none)
    expect(idle.transport).toBe('none')
    idle.onTile(() => answers.push(null as unknown as GroundTileResult))
    idle.postTile(jobs()[0]!)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(none.stats().kinds.length === 0 || none.stats().kinds.every((k) => k.submitted === 0)).toBe(true)
    expect(answers.length).toBe(posted.length)
  })
})
