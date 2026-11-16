import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import type { BodyId, PhysicsWorld, RayHit } from '@adatechnology/game-physics'
import { createTerrain } from '@adatechnology/game-terrain'

import { PieceSystem } from '../src/pieces'
import type { PieceBody } from '../src/internal'
import { IS_JOLT, physicsOption } from './setup-physics'

/**
 * T3.8ad: a tile the terrain's own bounds prove level is laid as a slab without reading its 25921 samples. The proof is exact, so the ground the engine gets is the one the full
 * read gives: a tile with any relief under it, a one-vertex crater included, takes the full read. Jolt only: the kit's own solver has no tiles.
 */
interface Engine {
  world: PhysicsWorld
  tiles: Map<number, { ground: BodyId; slab: boolean; samples: Float64Array | null; level: number | null; dirty: unknown }>
  fellThrough: number
  layTile(key: number, ix: number, iz: number, tile: unknown): void
}

const KEY = 65536
const ORIGIN = 32768
const keyOf = (ix: number, iz: number): number => (ix + ORIGIN) * KEY + (iz + ORIGIN)
const FULL_READ = 25921

interface Lab {
  readonly system: PieceSystem
  readonly engine: Engine
  readonly terrain: ReturnType<typeof createTerrain>
  readonly reads: { count: number }
}

/** A system over a terrain, with or without the terrain's bounds handed to the engine (without: every tile is read, as before). */
const lab = (withRange: boolean, bump?: (x: number, z: number) => number, shared?: ReturnType<typeof createTerrain>): Lab => {
  const terrain = shared ?? createTerrain({ bounds: [-8, -8, 8, 8], cellSize: 0.1, layout: { surface: 'dirt' }, ...(bump ? { baseHeight: bump } : {}) })
  const reads = { count: 0 }
  const groundAt = (x: number, z: number): number => {
    reads.count++
    return terrain.heightAt(x, z)
  }
  const system = new PieceSystem(THREE, {
    physics: physicsOption(),
    groundAt,
    gravity: 9.81,
    onHardLanding: () => undefined,
    scene: new THREE.Scene(),
    ...(withRange ? { terrainRangeAt: (a: number, b: number, c: number, d: number) => terrain.heightRange(a, b, c, d) } : {}),
  })
  if (!shared) terrain.onDeform((region) => system.wakeRegion(region.x, region.z, region.radius))
  return { system, engine: (system as unknown as { engine: Engine }).engine, terrain, reads }
}

/** The top of the ground body of the tile at (ix, iz) (the height field or slab, not the solid under it nor a piece on it), by rays down a lattice 0.31 m apart and off every cell edge. */
const surfaceOf = (l: Lab, ix: number, iz: number): number[] => {
  const out: number[] = []
  const hits: RayHit[] = []
  for (let z = 0.013; z < 2; z += 0.31) {
    for (let x = 0.013; x < 2; x += 0.31) {
      hits.length = 0
      l.engine.world.rayAll([ix * 2 + x, 5, iz * 2 + z], [0, -1, 0], 10, hits)
      const ground = l.engine.tiles.get(keyOf(ix, iz))?.ground
      const hit = hits.find((h) => h.body === ground)
      out.push(hit ? 5 - hit.distance : NaN)
    }
  }
  return out
}

const same = (a: number[], b: number[]): void => {
  expect(a.length).toBe(b.length)
  a.forEach((h, i) => expect(h === b[i] || (Number.isNaN(h) && Number.isNaN(b[i]!)) || Math.abs(h - b[i]!) < 1e-9).toBe(true))
}

describe.skipIf(!IS_JOLT)('a tile proved level from the terrain is laid without reading it (T3.8ad)', () => {
  it('level ground: a slab, and one sample read where the full read took 25921, with the ground the full read gives', () => {
    const fast = lab(true)
    const full = lab(false)
    fast.reads.count = 0
    fast.engine.layTile(keyOf(0, 0), 0, 0, undefined)
    full.engine.layTile(keyOf(0, 0), 0, 0, undefined)
    expect(fast.reads.count).toBeLessThanOrEqual(1)
    expect(full.reads.count).toBe(FULL_READ)
    const tile = fast.engine.tiles.get(keyOf(0, 0))!
    expect(tile.slab).toBe(true)
    expect(tile.samples).toBeNull()
    same(surfaceOf(fast, 0, 0), surfaceOf(full, 0, 0))
  })

  it('level ground at another height lays the slab at that height', () => {
    const at = (): number => 0.4
    const fast = lab(true, at)
    const full = lab(false, at)
    fast.engine.layTile(keyOf(1, -1), 1, -1, undefined)
    full.engine.layTile(keyOf(1, -1), 1, -1, undefined)
    expect(fast.engine.tiles.get(keyOf(1, -1))!.slab).toBe(true)
    same(surfaceOf(fast, 1, -1), surfaceOf(full, 1, -1))
    expect(surfaceOf(fast, 1, -1)[0]).toBeCloseTo(0.4, 6)
  })

  it('never applies to a tile that is not level: a one-vertex bump of a micrometre, a single 5 cm dig, a slope', () => {
    const grounds: Array<[string, (x: number, z: number) => number]> = [
      ['a micrometre on one vertex', (x, z) => (Math.abs(x - 0.7) < 1e-6 && Math.abs(z - 0.9) < 1e-6 ? 1e-6 : 0)],
      ['a slope of 1 mm a metre', (x) => 0.001 * x],
    ]
    for (const [name, bump] of grounds) {
      const fast = lab(true, bump)
      const full = lab(false, bump)
      fast.reads.count = 0
      fast.engine.layTile(keyOf(0, 0), 0, 0, undefined)
      full.engine.layTile(keyOf(0, 0), 0, 0, undefined)
      expect(fast.reads.count, name).toBe(FULL_READ)
      expect(fast.engine.tiles.get(keyOf(0, 0))!.slab, name).toBe(full.engine.tiles.get(keyOf(0, 0))!.slab)
      same(surfaceOf(fast, 0, 0), surfaceOf(full, 0, 0))
    }
    const fast = lab(true)
    const full = lab(false)
    for (const l of [fast, full]) l.terrain.dig({ x: 0.7, z: 0.9, depth: 0.05 })
    fast.reads.count = 0
    fast.engine.layTile(keyOf(0, 0), 0, 0, undefined)
    full.engine.layTile(keyOf(0, 0), 0, 0, undefined)
    expect(fast.reads.count).toBe(FULL_READ)
    expect(fast.engine.tiles.get(keyOf(0, 0))!.slab).toBe(false)
    same(surfaceOf(fast, 0, 0), surfaceOf(full, 0, 0))
  })

  it('a crater of any size in the tile, however small, is found: every dig depth and place gives the full read, and the same ground', () => {
    // tiny craters first: a 1 cm bite is the least the terrain's own dig leaves, and it moves a vertex of the 0.1 m grid
    for (const [x, z, depth] of [[0.05, 0.05, 0.002], [1.99, 1.99, 0.01], [1.0, 0.0, 0.05], [0.0, 1.95, 0.2]] as const) {
      const fast = lab(true)
      const full = lab(false)
      fast.engine.layTile(keyOf(0, 0), 0, 0, undefined)
      full.engine.layTile(keyOf(0, 0), 0, 0, undefined)
      for (const l of [fast, full]) l.terrain.dig({ x, z, depth })
      fast.reads.count = 0
      fast.engine.layTile(keyOf(0, 0), 0, 0, fast.engine.tiles.get(keyOf(0, 0)))
      full.engine.layTile(keyOf(0, 0), 0, 0, full.engine.tiles.get(keyOf(0, 0)))
      const a = fast.engine.tiles.get(keyOf(0, 0))!
      const b = full.engine.tiles.get(keyOf(0, 0))!
      expect(a.slab, `${x},${z},${depth}`).toBe(b.slab)
      same(surfaceOf(fast, 0, 0), surfaceOf(full, 0, 0))
    }
  })

  it('a flat tile told about a change that changed nothing is laid again without a read and without a body made', () => {
    const l = lab(true)
    l.engine.layTile(keyOf(0, 0), 0, 0, undefined)
    const bodies = l.engine.world.bodyCount
    l.system.wakeRegion(1, 1, 0.5)
    expect(l.engine.tiles.get(keyOf(0, 0))!.dirty).not.toBeNull()
    l.reads.count = 0
    l.engine.layTile(keyOf(0, 0), 0, 0, l.engine.tiles.get(keyOf(0, 0)))
    expect(l.engine.tiles.get(keyOf(0, 0))!.dirty).toBeNull()
    expect(l.reads.count).toBeLessThanOrEqual(1)
    expect(l.engine.world.bodyCount).toBe(bodies)
  })

  it('a flat tile dug under a resting plate: woken, never under the ground, fellThrough 0, and ends where the full read ends', () => {
    const run = (withRange: boolean): { y: number; sleeping: boolean; fellThrough: number; slab: boolean } => {
      const l = lab(withRange)
      const root = new THREE.Object3D()
      root.position.set(1, 0.1, 1)
      const plate: PieceBody = l.system.create('plate', root, [0.1, 0.02, 0.1], new THREE.Vector3(), 2)
      for (let i = 0; i < 240; i++) l.system.update(1 / 60)
      expect(plate.sleeping).toBe(true)
      for (let k = 0; k < 3; k++) l.terrain.dig({ x: 1, z: 1, depth: 0.2 })
      let lowest = Infinity
      for (let i = 0; i < 360; i++) {
        l.system.update(1 / 60)
        lowest = Math.min(lowest, root.position.y - l.terrain.heightAt(root.position.x, root.position.z))
      }
      expect(lowest).toBeGreaterThan(0.02 - 0.01)
      return { y: root.position.y, sleeping: plate.sleeping, fellThrough: l.engine.fellThrough, slab: l.engine.tiles.get(keyOf(0, 0))!.slab }
    }
    const fast = run(true)
    const full = run(false)
    expect(fast.fellThrough).toBe(0)
    expect(full.fellThrough).toBe(0)
    expect(fast.slab).toBe(false)
    expect(fast.sleeping).toBe(true)
    expect(Math.abs(fast.y - full.y)).toBeLessThan(0.002)
  })

  it('200 digs and fills over flat ground leak no body and no heap, and every tile ends as the full read ends it', () => {
    const l = lab(true)
    const root = new THREE.Object3D()
    root.position.set(1, 0.1, 1)
    l.system.create('plate', root, [0.1, 0.02, 0.1], new THREE.Vector3(), 2)
    for (let i = 0; i < 120; i++) l.system.update(1 / 60)
    const round = (k: number): void => {
      if (k % 2 === 0) {
        l.terrain.dig({ x: 1, z: 1, depth: 0.1, dump: { x: 1.6, z: 1.6 } })
        // the heap the dig leaves is not announced by the terrain; the host that dug says so
        l.system.wakeRegion(1.6, 1.6, 0.5)
      }
      else l.terrain.fill({ x: 1, z: 1, from: { x: 1.6, z: 1.6, radius: 0.5 }, volume: 0.03 })
      l.system.update(1 / 60)
    }
    for (let k = 0; k < 6; k++) round(k)
    const bytes = l.engine.world.memoryInUse()
    const bodies = l.engine.world.bodyCount
    for (let k = 6; k < 206; k++) round(k)
    expect(l.engine.world.bodyCount).toBe(bodies)
    expect(Math.abs(l.engine.world.memoryInUse() - bytes)).toBeLessThan(16384)
    // a tile is laid when a piece needs it: the ones still marked are laid now, as the next piece over them would
    for (const [ix, iz] of [[0, 0], [0, 1], [1, 0], [1, 1]] as const) {
      const tile = l.engine.tiles.get(keyOf(ix, iz))
      if (tile?.dirty) l.engine.layTile(keyOf(ix, iz), ix, iz, tile)
    }
    const full = lab(false, undefined, l.terrain)
    full.engine.layTile(keyOf(0, 0), 0, 0, undefined)
    full.engine.layTile(keyOf(0, 1), 0, 1, undefined)
    full.engine.layTile(keyOf(1, 0), 1, 0, undefined)
    full.engine.layTile(keyOf(1, 1), 1, 1, undefined)
    for (const [ix, iz] of [[0, 0], [0, 1], [1, 0], [1, 1]] as const) {
      const got = surfaceOf(l, ix, iz)
      const want = surfaceOf(full, ix, iz)
      got.forEach((h, i) => {
        if (!Number.isNaN(h)) expect(Math.abs(h - want[i]!), `${ix},${iz}`).toBeLessThan(3.3e-4)
      })
    }
  })
})
