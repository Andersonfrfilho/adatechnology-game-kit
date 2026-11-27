import { createHash } from 'node:crypto'

import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import type { WorkerLike, WorkerScopeLike } from '@adatechnology/game-shapes'
import { createTerrain } from '@adatechnology/game-terrain'
import type { Terrain } from '@adatechnology/game-terrain'

import { GROUND_CELL, readGround, sampleCount, shapeGround } from '../src/engine-ground'
import type { GroundTile } from '../src/engine-ground'
import { bandLength, computeGroundTile, jobTransferOf, latticePatchRead, readGroundBand, readGroundPatch, tileOfResult, transferOf } from '../src/engine-ground-job'
import type { GroundTileJob, GroundTileResult } from '../src/engine-ground-job'
import { createInlineGroundPort, createMainThreadGroundPort, createWorkerGroundPort, installGroundWorker } from '../src/engine-ground-port'
import type { GroundWorkerPort } from '../src/engine-ground-port'
import type { GroundSchedule } from '../src/engine-ground-schedule'
import { buildSolidVolume } from '../src/engine-ground-solid'
import { PieceSystem } from '../src/pieces'
import { physicsOption } from './setup-physics'

/**
 * Ground tiles asked for with the terrain's vertices (`Terrain.heightPatch`, about 26 x 26 numbers) instead of their samples and band (about 60 000): the worker, or the main
 * thread at the tile's update, makes the samples and band from the patch with the terrain's own blend, so the tile is the one read from the terrain, to the bit.
 */
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

const SAMPLES = sampleCount(Math.round(2 / GROUND_CELL))
const across = <T>(value: T, transfer: ArrayBuffer[]): T => structuredClone(value, { transfer })

/** A cratered, dug, pressed terrain with loose soil heaped, its bounds off the 2 m tile grid (a patch is not aligned to the tiles). */
const fought = (): Terrain => {
  const terrain = createTerrain({ bounds: [-6.13, -6.05, 6.07, 6.11], cellSize: 0.1, layout: { surface: 'dirt' }, baseHeight: (x, z) => 0.04 * Math.sin(2 * x + z) })
  terrain.strike('explosive', { x: 0.37, z: -0.21, energy: 4e6 })
  terrain.strike('ballistic', { x: 1.13, z: 3.31, energy: 2000 })
  for (let k = 0; k < 4; k++) terrain.dig({ x: -2.43, z: 1.2, depth: 0.2 })
  terrain.dig({ x: -1.1, z: -2.7, dump: { x: -1.4, z: -2.2 } })
  terrain.press({ x: 1.5, z: -1.5, radius: 0.3 })
  for (let k = 0; k < 60; k++) terrain.update(1 / 60)
  return terrain
}

/** Today's job: the samples and band read from the terrain through its grid. */
const readJob = (terrain: Terrain, x0: number, z0: number, wasCoarse = false): GroundTileJob => {
  const groundAt = (x: number, z: number): number => terrain.heightAt(x, z)
  const samples = new Float64Array(SAMPLES)
  readGround(groundAt, samples, x0, z0, 2, undefined, terrain.heightGrid)
  const band = new Float64Array(bandLength(2)).fill(NaN)
  readGroundBand(groundAt, band, x0, z0, 2, terrain.heightGrid)
  return { id: 1, x0, z0, size: 2, wasCoarse, samples, band }
}

const EMPTY = new Float64Array(0)
const patchJob = (terrain: Terrain, x0: number, z0: number, wasCoarse = false): GroundTileJob => {
  const patch = readGroundPatch(terrain.heightPatch, x0, z0, 2)
  if (!patch) throw new Error(`no patch at ${x0}, ${z0}`)
  return { id: 1, x0, z0, size: 2, wasCoarse, samples: EMPTY, band: EMPTY, patch }
}

/** Tiles over the crater, the dig, the pressed print, the heaped soil, and two at the inner edge of the bounds; and two off the 2 m grid (moved). */
const TILES = [[0, -2], [-2, -2], [0, 0], [-2, 0], [-4, 0], [2, -2], [-5.93, -5.85], [3.85, 3.9], [0.37, -1.13], [-3.3, 1.9]] as const

describe('ground tiles made from the terrain\'s vertices (patch jobs): the same tile, to the bit', () => {
  it('a patch job makes the tile today\'s job (samples and band read from the terrain) makes, here and across a clone with transfer, from the coarse field or not', () => {
    const terrain = fought()
    for (const [x0, z0] of TILES) {
      for (const wasCoarse of [false, true]) {
        const expected = tilePrint(tileOfResult(computeGroundTile(readJob(terrain, x0, z0, wasCoarse)), null))
        const job = patchJob(terrain, x0, z0, wasCoarse)
        expect(tilePrint(tileOfResult(computeGroundTile(job), null)), `${x0},${z0} here`).toBe(expected)
        const sent = across(patchJob(terrain, x0, z0, wasCoarse), jobTransferOf(job))
        const answer = computeGroundTile(sent)
        const back = across(answer, transferOf(answer))
        expect(tilePrint(tileOfResult(back, null)), `${x0},${z0} cloned`).toBe(expected)
        // the job's own patch comes back for the pool, and no samples or band cross
        expect(back.patch?.length).toBe(sent.patch!.width * sent.patch!.depth)
        expect([back.samples.length, back.band.length]).toEqual([0, 0])
      }
    }
  })

  it('a tile asked again after the ground changed is, from the patch, the tile made from the held samples read again where it changed', () => {
    const terrain = fought()
    for (const [x0, z0] of TILES.slice(0, 6)) {
      const held = new Float64Array(SAMPLES)
      const groundAt = (x: number, z: number): number => terrain.heightAt(x, z)
      readGround(groundAt, held, x0, z0, 2, undefined, terrain.heightGrid)
      const before = readGroundPatch(terrain.heightPatch, x0, z0, 2)!
      const dug = terrain
      dug.dig({ x: x0 + 1.3, z: z0 + 0.7, depth: 0.12 })
      const after = readGroundPatch(dug.heightPatch, x0, z0, 2)!
      expect(after.heights.subarray(0, after.width * after.depth)).not.toEqual(before.heights.subarray(0, before.width * before.depth))
      readGround((x, z) => dug.heightAt(x, z), held, x0, z0, 2, { minX: x0 + 0.5, maxX: x0 + 2.1, minZ: z0 - 0.1, maxZ: z0 + 1.5 }, dug.heightGrid)
      const t = shapeGround(held, x0, z0, 2, null, false)
      const solid = t.level === null ? buildSolidVolume(t.heights, t.cells, x0, z0, 2 / t.cells, (x, z) => dug.heightAt(x, z), t.cells / t.collisionCells) : { boxes: [], ring: [] }
      expect(tilePrint(tileOfResult(computeGroundTile(patchJob(dug, x0, z0)), null)), `${x0},${z0}`).toBe(tilePrint({ ...t, solid }))
    }
  })

  it('a tile whose ring crosses the terrain\'s bounds has no patch: it is read as before', () => {
    const terrain = fought()
    for (const [x0, z0] of [[-8, 0], [6, 0], [0, -6.1], [4.2, 0], [-6.2, -6.2]] as const) expect(readGroundPatch(terrain.heightPatch, x0, z0, 2), `${x0},${z0}`).toBeNull()
    // just inside: the ring's outermost band points on the bounds or within
    expect(readGroundPatch(terrain.heightPatch, -5.93, -5.85, 2)).not.toBeNull()
  })

  it('the warm patch (a lattice read through readGroundPatch) fits the tile and its ring whatever their size and place: its job makes a tile, no throw', () => {
    const warm = (x: number, z: number): number => 0.3 * x - 0.2 * z + 0.15 * Math.floor(x / 0.37) + 0.05 * Math.sin(3 * z)
    for (const size of [2, 1, 3.3, 4]) {
      for (const [x0, z0] of [[0, 0], [-7.3, 2.05], [12, -40]] as const) {
        const patch = readGroundPatch(latticePatchRead(warm), x0, z0, size)!
        const result = computeGroundTile({ id: 0, x0, z0, size, wasCoarse: false, samples: EMPTY, band: EMPTY, patch })
        expect(result.cells, `${size} at ${x0},${z0}`).toBe(Math.round(size / GROUND_CELL))
        expect(result.level).toBeNull()
      }
    }
  })

  it('the worker of the package answers a patch job with its tile, the patch handed back transferred', () => {
    const terrain = fought()
    const answers: GroundTileResult[] = []
    const scope: WorkerScopeLike = { onmessage: null, postMessage: (message, transfer) => answers.push(across(message as GroundTileResult, transfer ?? [])) }
    installGroundWorker(scope)
    const job = patchJob(terrain, 0, -2)
    const count = job.patch!.width * job.patch!.depth
    scope.onmessage?.({ data: across(job, jobTransferOf(job)) })
    expect(job.patch!.heights.byteLength).toBe(0)
    expect(answers[0]!.patch?.length).toBe(count)
    expect(tilePrint(tileOfResult(answers[0]!, null))).toBe(tilePrint(tileOfResult(computeGroundTile(readJob(terrain, 0, -2)), null)))
  })
})

/** A port that answers when the test says, in any order, or never. */
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

const clonedWorker = (): WorkerLike & { flush(): void } => {
  const toWorker: Array<() => void> = []
  const toMain: Array<() => void> = []
  const scope: WorkerScopeLike = { onmessage: null, postMessage: (message, transfer) => {
    const copy = across(message, transfer ?? [])
    toMain.push(() => worker.onmessage?.({ data: copy }))
  } }
  installGroundWorker(scope)
  const worker = {
    onmessage: null as WorkerLike['onmessage'],
    postMessage(message: unknown, transfer?: ArrayBuffer[]) {
      const copy = across(message, transfer ?? [])
      toWorker.push(() => scope.onmessage?.({ data: copy }))
    },
    terminate() {},
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
  world: { saveState(): Uint8Array }
  tiles: Map<number, { samples: Float64Array | null; patch: unknown }>
}

/** The crater drop of `engine-ground-worker`, its tiles asked with patches or with samples, a dig under the boxes at update 40 and another at 70 on the edge of the drop. */
const runCrater = (port: GroundWorkerPort, updates: number, patches: boolean, between?: (update: number) => void) => {
  const terrain = createTerrain({ bounds: [-6, -6, 6, 6], cellSize: 0.1, layout: { surface: 'dirt' }, baseHeight: (x, z) => 0.04 * Math.sin(2 * x + z) })
  terrain.strike('explosive', { x: 0.37, z: -0.21, energy: 4e6 })
  for (let k = 0; k < 4; k++) terrain.dig({ x: -2.43, z: 1.2, depth: 0.2 })
  const system = new PieceSystem(THREE, {
    physics: physicsOption(), groundAt: (x, z) => terrain.heightAt(x, z), terrainAt: (x, z) => terrain.heightAt(x, z), terrainRangeAt: terrain.heightRange, terrainGridAt: terrain.heightGrid,
    ...(patches ? { terrainPatchAt: terrain.heightPatch } : {}),
    gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene(), groundWorker: port, groundWorkerFrames: 2,
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
    if (u === 70) {
      terrain.strike('explosive', { x: 1.9, z: 0.1, energy: 5e5 })
      system.wakeRegion(1.9, 0.1, 1.2)
    }
    system.update(1 / 60)
    const hash = createHash('sha256')
    for (const root of roots) {
      pose.set([...root.position.toArray(), ...root.quaternion.toArray()])
      hash.update(pose)
    }
    hash.update(engine.world.saveState())
    hashes.push(hash.digest('hex').slice(0, 16))
  }
  return { hashes, engine, system }
}

describe('engine ground asked with patches: the physics is today\'s, with or without the worker', () => {
  it('the engine warms the worker with a patch job built for its real tile and ring: the inline port runs it in the constructor without a throw, the worker answers it', () => {
    const terrain = createTerrain({ bounds: [-6, -6, 6, 6], cellSize: 0.1, layout: { surface: 'dirt' } })
    const options = { physics: physicsOption(), groundAt: (x: number, z: number) => terrain.heightAt(x, z), terrainAt: (x: number, z: number) => terrain.heightAt(x, z), terrainGridAt: terrain.heightGrid, terrainPatchAt: terrain.heightPatch, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene() }
    const inline = createInlineGroundPort()
    const system = new PieceSystem(THREE, { ...options, groundWorker: inline })
    const engine = (system as unknown as { engine: Engine }).engine
    expect(engine.schedule.stats).toEqual({ asked: 0, inTime: 0, fellBack: 0, late: 0 })
    expect(engine.schedule.outstanding).toBe(0)
    system.dispose()
    const worker = clonedWorker()
    const posted: GroundTileJob[] = []
    const send = worker.postMessage.bind(worker)
    worker.postMessage = (message: unknown, transfer?: ArrayBuffer[]) => {
      posted.push(message as GroundTileJob)
      send(message, transfer)
    }
    const withWorker = new PieceSystem(THREE, { ...options, physics: physicsOption(), groundWorker: createWorkerGroundPort(worker) })
    worker.flush()
    // a samples warm job and a patch one, both answered
    expect(posted.map((job) => [job.id, job.patch !== undefined])).toEqual([[0, false], [0, true]])
    expect((withWorker as unknown as { engine: Engine }).engine.schedule.outstanding).toBe(0)
    withWorker.dispose()
  })

  it('main thread, inline, a cloned worker and a slow one: every update bit-identical, and the same as the tiles read from samples', { timeout: 120000 }, () => {
    const samples = runCrater(createMainThreadGroundPort(), 120, false)
    const reference = runCrater(createMainThreadGroundPort(), 120, true)
    // the tiles were asked with patches, not samples
    const tiles = [...reference.engine.tiles.values()].filter((t) => t.patch !== null)
    expect(tiles.length).toBeGreaterThan(3)
    expect(tiles.every((t) => t.samples === null)).toBe(true)
    expect(reference.engine.fellThrough).toBe(0)
    expect(reference.hashes).toEqual(samples.hashes)
    const { asked } = reference.engine.schedule.stats
    expect(asked).toBe(samples.engine.schedule.stats.asked)
    expect(runCrater(createInlineGroundPort(), 120, true).hashes).toEqual(reference.hashes)
    const worker = clonedWorker()
    const cloned = runCrater(createWorkerGroundPort(worker), 120, true, () => worker.flush())
    expect(cloned.hashes).toEqual(reference.hashes)
    worker.flush()
    // §8: every pooled buffer back, the pool a few tiles deep, no patch held but the tiles' own
    expect(cloned.engine.schedule.outstanding).toBe(0)
    expect(cloned.engine.schedule.pooled).toBeLessThanOrEqual(3 * 12)
    const slow = manualPort()
    let posted = 0
    const late = new Map<GroundTileJob, number>()
    const run = runCrater(slow, 120, true, (u) => {
      for (const job of slow.jobs) if (!late.has(job)) late.set(job, u + ((posted++ % 2) * 3))
      slow.deliver((job, i) => job.id % 3 !== 0 && (late.get(job) ?? Infinity) <= u + (i % 2))
    })
    expect(run.hashes).toEqual(reference.hashes)
    const stats = run.engine.schedule.stats
    expect(stats.inTime).toBeGreaterThan(0)
    expect(stats.fellBack).toBeGreaterThan(0)
    expect(stats.inTime + stats.fellBack).toBe(asked)
  })
})
