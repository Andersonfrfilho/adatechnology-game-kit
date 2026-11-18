import { createHash } from 'node:crypto'

import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import type { PhysicsWorld } from '@adatechnology/game-physics'
import type { WorkerLike, WorkerScopeLike } from '@adatechnology/game-shapes'
import { createTerrain } from '@adatechnology/game-terrain'
import type { Terrain } from '@adatechnology/game-terrain'

import { GROUND_CELL, buildGroundTile, readGround, sampleCount, shapeGround } from '../src/engine-ground'
import type { GroundTile } from '../src/engine-ground'
import { bandLength, computeGroundTile, readGroundBand, tileOfResult, transferOf } from '../src/engine-ground-job'
import type { GroundTileJob, GroundTileResult } from '../src/engine-ground-job'
import { createInlineGroundPort, createMainThreadGroundPort, createWorkerGroundPort, installGroundWorker } from '../src/engine-ground-port'
import type { GroundWorkerPort } from '../src/engine-ground-port'
import type { GroundSchedule } from '../src/engine-ground-schedule'
import { buildSolidVolume } from '../src/engine-ground-solid'
import { PieceSystem } from '../src/pieces'
import { IS_JOLT, physicsOption } from './setup-physics'

/**
 * The engine's ground tiles made off the main thread (owner decision 2026-11-17): a tile is a pure function of the samples and the band read at the frame it is asked for, so the
 * worker's tile is the main thread's to the bit; and it is applied a fixed number of updates later whatever the worker does, so the physics never depends on its timing.
 */

/** FNV-1a over the bits of the numbers, as doubles (the fingerprint of `engine-ground-identity`). */
const fingerprint = (...lists: ReadonlyArray<ArrayLike<number>>): string => {
  let hash = 0x811c9dc5
  const cell = new Float64Array(1)
  const bytes = new Uint8Array(cell.buffer)
  for (const list of lists) {
    cell[0] = list.length
    for (const b of bytes) hash = Math.imul(hash ^ b, 0x01000193)
    for (let i = 0; i < list.length; i++) {
      cell[0] = list[i]!
      for (const b of bytes) hash = Math.imul(hash ^ b, 0x01000193)
    }
  }
  return (hash >>> 0).toString(16)
}
const tilePrint = (t: GroundTile): string => fingerprint(t.heights, t.collision, [t.cells, t.collisionCells, t.level ?? NaN], t.boxes, t.solid.boxes, t.solid.ring)

type Ground = (x: number, z: number) => number
const SAMPLES = sampleCount(Math.round(2 / GROUND_CELL))

const craterTerrain = (): Terrain => {
  const terrain = createTerrain({ bounds: [-6, -6, 6, 6], cellSize: 0.1, layout: { surface: 'dirt' }, baseHeight: (x, z) => 0.04 * Math.sin(2 * x + z) })
  terrain.strike('explosive', { x: 0.37, z: -0.21, energy: 4e6 })
  for (let k = 0; k < 4; k++) terrain.dig({ x: -2.43, z: 1.2, depth: 0.2 })
  return terrain
}

/** The grounds of the identity fingerprints: a crater (read through the terrain's grid too), terraces (step boxes), a bowl (the coarse field), a tilted plane. */
const grounds = (): ReadonlyArray<{ name: string; groundAt: Ground; grid?: Terrain['heightGrid']; tiles: ReadonlyArray<readonly [number, number]> }> => {
  const terrain = craterTerrain()
  return [
    { name: 'crater', groundAt: (x, z) => terrain.heightAt(x, z), grid: terrain.heightGrid, tiles: [[0, -2], [-2, -2], [0, 0], [-2, 0], [-4, 0], [4, -2], [6, -2]] },
    { name: 'terraces', groundAt: (x, z) => 0.15 * Math.floor((x + 0.3 * z) / 0.37), tiles: [[0, 0], [2, -2]] },
    { name: 'bowl', groundAt: (x, z) => -0.4 * Math.max(0, 1 - Math.hypot(x - 1.1, z - 0.9) / 1.6) ** 2, tiles: [[0, 0], [2, 0]] },
    { name: 'tilted', groundAt: (x, z) => 0.21 * x - 0.13 * z, tiles: [[0, 0]] },
  ]
}

/** The job the main thread posts for a tile: its samples and band, read through the grid when there is one. */
const jobOf = (groundAt: Ground, x0: number, z0: number, grid?: Terrain['heightGrid'], samples?: Float64Array, wasCoarse = false): GroundTileJob => {
  const held = samples ?? new Float64Array(SAMPLES)
  if (!samples) readGround(groundAt, held, x0, z0, 2, undefined, grid)
  const band = new Float64Array(bandLength(2)).fill(NaN)
  readGroundBand(groundAt, band, x0, z0, 2, grid)
  return { id: 1, x0, z0, size: 2, wasCoarse, samples: held, band }
}

/** A result across a thread boundary: structured-cloned with its buffers transferred, as `postMessage` does. */
const across = <T>(value: T, transfer: ArrayBuffer[]): T => structuredClone(value, { transfer })

describe('engine ground made off the main thread: the same tile, to the bit', () => {
  it('a new tile from the job (samples and band read ahead, grid or calls) is the tile made on the main thread, and through a worker\'s clone too', () => {
    for (const { name, groundAt, grid, tiles } of grounds()) {
      for (const [x0, z0] of tiles) {
        const sync = tilePrint(buildGroundTile(groundAt, x0, z0, 2, true))
        for (const read of grid ? [grid, undefined] : [undefined]) {
          const job = jobOf(groundAt, x0, z0, read)
          const samples = job.samples.slice()
          const here = computeGroundTile(job)
          expect(tilePrint(tileOfResult(here, samples)), `${name} ${x0},${z0} ${read ? 'grid' : 'calls'}`).toBe(sync)
          const there = across(computeGroundTile(jobOf(groundAt, x0, z0, read)), transferOf(here))
          expect(tilePrint(tileOfResult(there, samples)), `${name} ${x0},${z0} cloned`).toBe(sync)
        }
      }
    }
  })

  it('a tile read again where the ground changed (from the coarse field or the read grid) is the one shapeGround and the solid over the host\'s ground make', () => {
    for (const { name, groundAt, tiles } of grounds()) {
      for (const [x0, z0] of tiles) {
        const moved: Ground = (x, z) => groundAt(x, z) - (Math.hypot(x - x0 - 1.3, z - z0 - 0.7) < 0.45 ? 0.06 : 0)
        const held = new Float64Array(SAMPLES)
        readGround(groundAt, held, x0, z0, 2)
        readGround(moved, held, x0, z0, 2, { minX: x0 + 0.8, maxX: x0 + 1.8, minZ: z0 + 0.2, maxZ: z0 + 1.2 })
        for (const wasCoarse of [false, true]) {
          const t = shapeGround(held, x0, z0, 2, null, wasCoarse)
          const solid = t.level === null ? buildSolidVolume(t.heights, t.cells, x0, z0, 2 / t.cells, moved, t.cells / t.collisionCells) : { boxes: [], ring: [] }
          const job = computeGroundTile(jobOf(moved, x0, z0, undefined, held.slice(), wasCoarse))
          expect(tilePrint(tileOfResult(job, held)), `${name} ${x0},${z0} ${wasCoarse}`).toBe(tilePrint({ ...t, solid }))
        }
      }
    }
  })

  it('the worker answers each job with its tile and hands every buffer back, transferred (none copied, none detached twice)', () => {
    const terrain = craterTerrain()
    const groundAt: Ground = (x, z) => terrain.heightAt(x, z)
    const answers: GroundTileResult[] = []
    const scope: WorkerScopeLike = { onmessage: null, postMessage: (message, transfer) => answers.push(across(message as GroundTileResult, transfer ?? [])) }
    installGroundWorker(scope)
    const job = jobOf(groundAt, 0, -2, terrain.heightGrid)
    const expected = tilePrint(tileOfResult(computeGroundTile(jobOf(groundAt, 0, -2, terrain.heightGrid)), job.samples.slice()))
    scope.onmessage?.({ data: job })
    expect(answers).toHaveLength(1)
    expect(answers[0]!.samples.length).toBe(SAMPLES)
    expect(answers[0]!.band.length).toBe(bandLength(2))
    expect(tilePrint(tileOfResult(answers[0]!, answers[0]!.samples))).toBe(expected)
  })
})

/** A port that answers when the test says (`deliver`), in any order, or never: a slow worker, a lost one. */
const manualPort = (): GroundWorkerPort & { jobs: GroundTileJob[]; deliver(pick: (job: GroundTileJob, index: number) => boolean): void } => {
  let handler: ((r: GroundTileResult) => void) | null = null
  const jobs: GroundTileJob[] = []
  return {
    transport: 'transfer',
    jobs,
    postTile: (job) => jobs.push(job),
    onTile: (h) => {
      handler = h
    },
    dispose: () => {
      handler = null
    },
    deliver(pick) {
      const due = jobs.filter(pick)
      for (const job of due) jobs.splice(jobs.indexOf(job), 1)
      for (const job of due) handler?.(computeGroundTile(job))
    },
  }
}

/** A worker over `installGroundWorker` whose messages cross by structured clone with transfer, delivered when the test flushes. */
const clonedWorker = (): WorkerLike & { flush(): void; terminated: boolean } => {
  const toWorker: Array<() => void> = []
  const toMain: Array<() => void> = []
  const scope: WorkerScopeLike = { onmessage: null, postMessage: (message, transfer) => {
    const copy = across(message, transfer ?? [])
    toMain.push(() => worker.onmessage?.({ data: copy }))
  } }
  installGroundWorker(scope)
  const worker = {
    onmessage: null as WorkerLike['onmessage'],
    terminated: false,
    postMessage(message: unknown, transfer?: ArrayBuffer[]) {
      const copy = across(message, transfer ?? [])
      toWorker.push(() => scope.onmessage?.({ data: copy }))
    },
    terminate() {
      worker.terminated = true
    },
    flush() {
      for (const run of toWorker.splice(0)) run()
      for (const run of toMain.splice(0)) run()
    },
  }
  return worker
}

interface Engine {
  schedule: GroundSchedule
  fellThrough: number
  world: PhysicsWorld
}

/** A seeded drop of boxes over the crater and its rim, and a dig under them at update 40; `between` runs before each update (a worker answering, or not). */
const runCrater = (port: GroundWorkerPort, updates: number, between?: (update: number) => void, frames = 2) => {
  const terrain = craterTerrain()
  const system = new PieceSystem(THREE, {
    physics: physicsOption(), groundAt: (x, z) => terrain.heightAt(x, z), terrainAt: (x, z) => terrain.heightAt(x, z), terrainRangeAt: terrain.heightRange, terrainGridAt: terrain.heightGrid,
    gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene(), groundWorker: port, groundWorkerFrames: frames,
  })
  let seed = 7
  const next = (): number => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
  const roots: THREE.Object3D[] = []
  for (let i = 0; i < 14; i++) {
    const root = new THREE.Object3D()
    const x = -1.5 + next() * 3.5, z = -2 + next() * 3
    root.position.set(x, terrain.heightAt(x, z) + 0.3 + next(), z)
    root.rotation.set(next(), next() * 3, next())
    roots.push(root)
    system.create(`box${i}`, root, [0.05 + 0.1 * next(), 0.04 + 0.05 * next(), 0.05 + 0.1 * next()], new THREE.Vector3(), 2 + 5 * next(), [(next() - 0.5) * 6, next() * 2, (next() - 0.5) * 6])
  }
  const engine = (system as unknown as { engine: Engine }).engine
  const hashes: string[] = []
  const pose = new Float64Array(7)
  for (let u = 1; u <= updates; u++) {
    between?.(u)
    if (u === 40) {
      terrain.dig({ x: 0.6, z: -0.5, depth: 0.15 })
      system.wakeRegion(0.6, -0.5, 1)
    }
    system.update(1 / 60)
    const hash = createHash('sha256')
    for (const root of roots) {
      pose.set([...root.position.toArray(), ...root.quaternion.toArray()])
      hash.update(pose)
    }
    hash.update((engine.world as unknown as { saveState(): Uint8Array }).saveState())
    hashes.push(hash.digest('hex').slice(0, 16))
  }
  return { hashes, engine, system, roots, terrain }
}

describe.skipIf(!IS_JOLT)('engine ground on a fixed schedule: the physics does not depend on the worker', () => {
  it('main thread, inline, a cloned worker answering every update, a slow one answering late or never: every update bit-identical (poses and the world\'s saved bytes)', { timeout: 120000 }, () => {
    const reference = runCrater(createMainThreadGroundPort(), 120)
    expect(reference.engine.fellThrough).toBe(0)
    expect(runCrater(createInlineGroundPort(), 120).hashes).toEqual(reference.hashes)
    const worker = clonedWorker()
    expect(runCrater(createWorkerGroundPort(worker), 120, () => worker.flush()).hashes).toEqual(reference.hashes)
    // a slow worker: odd jobs answered two updates late (past their frame: made on the main thread instead), even ones at once, every third one never
    const slow = manualPort()
    let asked = 0
    const late = new Map<GroundTileJob, number>()
    const run = runCrater(slow, 120, (u) => {
      for (const job of slow.jobs) if (!late.has(job)) late.set(job, u + ((asked++ % 2) * 3))
      slow.deliver((job, i) => job.id % 3 !== 0 && (late.get(job) ?? Infinity) <= u + (i % 2))
    })
    expect(run.hashes).toEqual(reference.hashes)
  })

  it('a piece over ground not laid yet waits held (kinematic, still) until the update its tile is applied at, then falls; none falls through', { timeout: 60000 }, () => {
    for (const frames of [2, 3]) {
      // asked at update 1 (the bodies are made then, lifted out of the ground if they were made in it), applied at 1 + frames: held through `frames` updates. Held is the
      // engine's: no fall, no turn (the kit may still slide two pieces born inside each other apart along the ground, `apartDeep`, which moves x and z only)
      const at = (updates: number) => runCrater(createMainThreadGroundPort(), updates, undefined, frames).roots.map((r) => [r.position.y, ...r.quaternion.toArray()])
      const first = at(1)
      expect(at(frames)).toEqual(first)
      const released = at(frames + 1)
      // let go with the speeds they were made with (some thrown up): every one moves
      expect(released.every((pose, i) => pose[0] !== first[i]![0])).toBe(true)
    }
    const long = runCrater(createMainThreadGroundPort(), 240, undefined, 3)
    expect(long.engine.fellThrough).toBe(0)
    for (const root of long.roots) expect(root.position.y).toBeGreaterThan(long.terrain.heightAt(root.position.x, root.position.z) - 0.02)
  })

  it('memory (§8): the pool takes every buffer back, the worker is terminated on dispose', { timeout: 60000 }, () => {
    const worker = clonedWorker()
    const run = runCrater(createWorkerGroundPort(worker), 90, () => worker.flush())
    worker.flush()
    const schedule = run.engine.schedule
    expect(schedule.pending.size).toBe(0)
    expect(schedule.outstanding).toBe(0)
    // a few tiles at once at most: the pool holds a sent copy and a band per tile in flight, not one per tile ever made
    expect(schedule.pooled).toBeLessThanOrEqual(3 * 12)
    const dispose = vi.spyOn(worker, 'terminate')
    run.system.dispose()
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(worker.terminated).toBe(true)
  })
})
