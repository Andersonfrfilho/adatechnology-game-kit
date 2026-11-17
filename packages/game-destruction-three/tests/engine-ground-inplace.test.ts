import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import type { BodyId, PhysicsWorld, RayHit } from '@adatechnology/game-physics'

import { PieceSystem } from '../src/pieces'
import type { PieceBody } from '../src/internal'
import { IS_JOLT, physicsOption } from './setup-physics'

/**
 * T3.8q: a height field tile whose ground changed is written in place (`updateHeights`) instead of made again. The ground must be the one a freshly laid tile has, the
 * pieces on it behave the same, and nothing leaks. Jolt only: the kit's own solver has no tiles.
 */
interface Engine {
  world: PhysicsWorld
  tiles: Map<number, { ground: BodyId; solid: BodyId | null; heights: Float32Array; writes: number; dirty: unknown; volume: { ring: readonly number[] } }>
  fellThrough: number
  layTile(key: number, ix: number, iz: number, tile: unknown): void
  groundChanged(x: number, z: number, radius: number): void
}

const KEY = 65536
const ORIGIN = 32768
const TILE_KEY = ORIGIN * KEY + ORIGIN
/** The cells of a 2 m tile are 2.5 cm: its heights are 81 a side. */
const SAMPLES = 81

const rolling = (x: number, z: number): number => 0.01 * Math.sin(2 * x) * Math.sin(2 * z)
const crater = (cx: number, cz: number, radius: number, depth: number) => (x: number, z: number): number => {
  const d = Math.hypot(x - cx, z - cz)
  return d >= radius ? 0 : -depth * Math.cos((Math.PI / 2) * (d / radius)) ** 2
}
/** A first crater 30 cm deep, then a second on its rim whose depth `k` changes: the heights stay inside the range the field was made with. */
// a third crater, small and sharp, keeps the tile on the 2.5 cm field whatever the second's depth (`collisionStep`): what is written in place is the same field's samples
const groundOf = (depth: number) => (x: number, z: number): number => rolling(x, z) + crater(1, 1, 0.6, 0.3)(x, z) + crater(1.9, 1, 0.3, depth)(x, z) + crater(0.4, 1.6, 0.2, 0.2)(x, z)
const SECOND = { x: 1.9, z: 1, radius: 0.3 }

interface Lab {
  readonly system: PieceSystem
  readonly engine: Engine
  readonly ground: { depth: number; reads: number }
}

const lab = (depth: number): Lab => {
  const ground = { depth, reads: 0 }
  const at = (x: number, z: number): number => {
    ground.reads++
    return groundOf(ground.depth)(x, z)
  }
  const system = new PieceSystem(THREE, { physics: physicsOption(), groundAt: at, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene() })
  return { system, engine: (system as unknown as { engine: Engine }).engine, ground }
}

const layFirst = (l: Lab): void => l.engine.layTile(TILE_KEY, 0, 0, undefined)
const layAgain = (l: Lab): void => l.engine.layTile(TILE_KEY, 0, 0, l.engine.tiles.get(TILE_KEY))

/** The height field's surface from rays over the tile (the tile's ground body only: the solid under it answers too). */
const surfaceOf = (l: Lab): number[] => {
  const ground = l.engine.tiles.get(TILE_KEY)!.ground
  const out: number[] = []
  const hits: RayHit[] = []
  for (let z = 1; z < SAMPLES - 1; z += 4) {
    for (let x = 1; x < SAMPLES - 1; x += 4) {
      hits.length = 0
      l.engine.world.rayAll([x * 0.025 + 0.003, 3, z * 0.025 + 0.003], [0, -1, 0], 6, hits)
      const hit = hits.find((h) => h.body === ground)
      out.push(hit ? 3 - hit.distance : NaN)
    }
  }
  return out
}

/** How far (m) a tile written in place may be from a fresh one: the fields' own quantizing (about 5e-5 each, measured) and what one write moves (4.4e-5, `MAX_IN_PLACE_WRITES`). */
const ONE_WRITE_TOLERANCE = 1.5e-4
const FOUR_WRITES_TOLERANCE = 3.3e-4

/** The spy on the world's two ways to change a ground body: written in place, or given a whole new shape. */
const spies = (l: Lab) => ({
  update: vi.spyOn(l.engine.world, 'updateHeights'),
  set: vi.spyOn(l.engine.world, 'setShape'),
})

describe.skipIf(!IS_JOLT)('a tile whose ground changed is written in place (T3.8q)', () => {
  it('gives the ground a freshly laid tile has: the heights the second crater made, within the quantisation, on the same body and with no new shape for it', () => {
    const changed = lab(0)
    layFirst(changed)
    const body = changed.engine.tiles.get(TILE_KEY)!.ground
    changed.ground.depth = 0.15
    changed.engine.groundChanged(SECOND.x, SECOND.z, SECOND.radius)
    const { update, set } = spies(changed)
    layAgain(changed)
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.results[0]!.value).toBe(true)
    expect(changed.engine.tiles.get(TILE_KEY)!.ground).toBe(body)
    // only the solid under the field gets a new shape: the ground body's shape is the one it had
    expect(set.mock.calls.filter((call) => call[0] === body)).toHaveLength(0)
    const fresh = lab(0.15)
    layFirst(fresh)
    const got = surfaceOf(changed)
    const want = surfaceOf(fresh)
    // two fields of quantized samples (each about 5e-5 m from the truth on this ground, measured) plus the 4.4e-5 m a write may move the blocks next to it
    const tolerance = ONE_WRITE_TOLERANCE
    expect(got.length).toBe(want.length)
    let worst = 0
    got.forEach((h, i) => {
      if (Number.isNaN(h) && Number.isNaN(want[i]!)) return
      worst = Math.max(worst, Math.abs(h - want[i]!))
    })
    expect(worst).toBeLessThanOrEqual(tolerance)
  })

  it('reads only the samples the host named from the ground, not the whole tile, and finds the same tile', () => {
    const l = lab(0)
    layFirst(l)
    l.ground.depth = 0.15
    l.engine.groundChanged(SECOND.x, SECOND.z, SECOND.radius)
    l.ground.reads = 0
    const ringBefore = l.engine.tiles.get(TILE_KEY)!.volume.ring.length / 3
    layAgain(l)
    // a whole tile reads 25921 samples; a 30 cm crater with its reach is about a sixth of the tile. The solid also reads the ground past the tile's edge where its
    // boxes reach (the crater is on the edge): the samples it held, read again to see if they moved, and those it reads anew
    const ring = ringBefore + l.engine.tiles.get(TILE_KEY)!.volume.ring.length / 3
    expect(l.ground.reads).toBeGreaterThan(0)
    expect(l.ground.reads - ring).toBeLessThan(25921 * 0.3)
    const fresh = lab(0.15)
    layFirst(fresh)
    const a = l.engine.tiles.get(TILE_KEY)!.heights
    const b = fresh.engine.tiles.get(TILE_KEY)!.heights
    expect(a.length).toBe(b.length)
    // the heights the engine is given are the ones a whole read makes, to the bit
    expect(a.every((h, i) => h === b[i])).toBe(true)
  })

  it('a tile told about a change that changed nothing reads its region and writes nothing', () => {
    const l = lab(0.15)
    layFirst(l)
    l.engine.groundChanged(SECOND.x, SECOND.z, SECOND.radius)
    const { update, set } = spies(l)
    layAgain(l)
    expect(update).not.toHaveBeenCalled()
    expect(set).not.toHaveBeenCalled()
    expect(l.engine.tiles.get(TILE_KEY)!.dirty).toBeNull()
  })

  it('a height outside the range the field was made with gives it a whole new shape, with the ground the fresh tile has', () => {
    const l = lab(0)
    layFirst(l)
    l.ground.depth = 0.5
    l.engine.groundChanged(SECOND.x, SECOND.z, SECOND.radius)
    const { update, set } = spies(l)
    layAgain(l)
    const body = l.engine.tiles.get(TILE_KEY)!.ground
    expect(update.mock.results.every((r) => r.value === false)).toBe(true)
    expect(set.mock.calls.filter((call) => call[0] === body)).toHaveLength(1)
    const fresh = lab(0.5)
    layFirst(fresh)
    const got = surfaceOf(l)
    const want = surfaceOf(fresh)
    got.forEach((h, i) => {
      if (!Number.isNaN(h)) expect(Math.abs(h - want[i]!)).toBeLessThan(1e-5)
    })
  })

  it('after four writes in a row the field is made again from the exact heights, so the requantizing next to a write never builds up', () => {
    const l = lab(0)
    layFirst(l)
    const body = l.engine.tiles.get(TILE_KEY)!.ground
    const { update, set } = spies(l)
    for (let k = 1; k <= 5; k++) {
      l.ground.depth = 0.05 * k
      l.engine.groundChanged(SECOND.x, SECOND.z, SECOND.radius)
      layAgain(l)
      expect(l.engine.tiles.get(TILE_KEY)!.writes).toBe(k <= 4 ? k : 0)
    }
    expect(update.mock.results.filter((r) => r.value === true)).toHaveLength(4)
    expect(set.mock.calls.filter((call) => call[0] === body)).toHaveLength(1)
  })

  it('a piece on the changed ground behaves as on a new shape: woken, never under the ground, and it ends where the other ends', () => {
    const run = (inPlace: boolean): { y: number; sleeping: boolean; fellThrough: number } => {
      const l = lab(0)
      const root = new THREE.Object3D()
      root.position.set(1.9, 0.2, 1)
      const plate: PieceBody = l.system.create('plate', root, [0.1, 0.02, 0.1], new THREE.Vector3(), 2)
      for (let i = 0; i < 240; i++) l.system.update(1 / 60)
      expect(plate.sleeping).toBe(true)
      // the host digs under it and tells the system (`wakeRegion` is what the terrain's deform event calls)
      l.ground.depth = 0.12
      if (!inPlace) vi.spyOn(l.engine.world, 'updateHeights').mockReturnValue(false)
      l.system.wakeRegion(SECOND.x, SECOND.z, SECOND.radius)
      let lowest = Infinity
      for (let i = 0; i < 360; i++) {
        l.system.update(1 / 60)
        lowest = Math.min(lowest, root.position.y - groundOf(0.12)(root.position.x, root.position.z))
      }
      // the underside of a plate lying flat is 2 cm below its centre
      expect(lowest).toBeGreaterThan(0.02 - 0.01)
      return { y: root.position.y, sleeping: plate.sleeping, fellThrough: l.engine.fellThrough }
    }
    const inPlace = run(true)
    const anew = run(false)
    expect(inPlace.fellThrough).toBe(0)
    expect(anew.fellThrough).toBe(0)
    expect(inPlace.sleeping).toBe(true)
    expect(anew.sleeping).toBe(true)
    expect(Math.abs(inPlace.y - anew.y)).toBeLessThan(0.002)
  })

  it('200 changes of the ground leak no body and no heap, and the tile ends as a fresh one', () => {
    const l = lab(0)
    const root = new THREE.Object3D()
    root.position.set(1.9, 0.2, 1)
    l.system.create('plate', root, [0.1, 0.02, 0.1], new THREE.Vector3(), 2)
    for (let i = 0; i < 120; i++) l.system.update(1 / 60)
    const spy = vi.spyOn(l.engine.world, 'updateHeights')
    const round = (k: number): void => {
      l.ground.depth = 0.05 + 0.05 * (k % 3)
      l.system.wakeRegion(SECOND.x, SECOND.z, SECOND.radius)
      l.system.update(1 / 60)
    }
    for (let k = 0; k < 6; k++) round(k)
    const bytes = l.engine.world.memoryInUse()
    const bodies = l.engine.world.bodyCount
    for (let k = 6; k < 206; k++) round(k)
    expect(l.engine.world.bodyCount).toBe(bodies)
    // the plate's contacts move the heap by a hundred bytes either way (the same slack as the other leak test); a leaked field or solid is tens of KB a round
    expect(Math.abs(l.engine.world.memoryInUse() - bytes)).toBeLessThan(4096)
    expect(spy.mock.results.filter((r) => r.value === true).length).toBeGreaterThan(100)
    const fresh = lab(l.ground.depth)
    layFirst(fresh)
    const got = surfaceOf(l)
    const want = surfaceOf(fresh)
    const tolerance = FOUR_WRITES_TOLERANCE
    let worst = 0
    got.forEach((h, i) => {
      if (!Number.isNaN(h)) worst = Math.max(worst, Math.abs(h - want[i]!))
    })
    expect(worst).toBeLessThanOrEqual(tolerance)
  })
})
