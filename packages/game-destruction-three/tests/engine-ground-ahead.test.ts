import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import { createTerrain } from '@adatechnology/game-terrain'

import { createDestructionRenderer } from '../src/renderer'
import { PieceSystem } from '../src/pieces'
import { FakeWorld } from './fake-world'
import { IS_JOLT, physicsOption } from './setup-physics'

/**
 * T3.8ad: the ground a blast reaches is laid at the blast, before the pieces it makes need it (nearest tiles first, up to a count), and the notices of one frame lay a tile once.
 * Jolt only: the kit's own solver has no tiles.
 */
interface Engine {
  tiles: Map<number, { dirty: unknown; slab: boolean }>
  layTile(key: number, ix: number, iz: number, tile: unknown): void
  groundChanged(x: number, z: number, radius: number): void
}

const KEY = 65536
const ORIGIN = 32768
const keyOf = (ix: number, iz: number): number => (ix + ORIGIN) * KEY + (iz + ORIGIN)
const FRAME = 1 / 60

const lab = (options: { blastGroundTiles?: number } = {}) => {
  const terrain = createTerrain({ bounds: [-40, -40, 40, 40], cellSize: 0.1, layout: { surface: 'dirt' } })
  const system = new PieceSystem(THREE, {
    physics: physicsOption(),
    groundAt: (x, z) => terrain.heightAt(x, z),
    terrainRangeAt: (a, b, c, d) => terrain.heightRange(a, b, c, d),
    gravity: 9.81,
    onHardLanding: () => undefined,
    scene: new THREE.Scene(),
    ...options,
  })
  terrain.onDeform((region) => system.wakeRegion(region.x, region.z, region.radius))
  return { terrain, system, engine: (system as unknown as { engine: Engine }).engine }
}

describe.skipIf(!IS_JOLT)('the ground a blast reaches is laid at the blast (T3.8ad)', () => {
  it('lays the tiles within the radius at the next update, and none beyond it', () => {
    const l = lab()
    l.system.layGroundAt(0.5, 0.5, 3)
    expect(l.engine.tiles.size).toBe(0)
    l.system.update(FRAME)
    // tiles are 2 m: those a 3 m disc around (0.5, 0.5) touches
    const want = new Set<number>()
    for (let ix = -3; ix <= 3; ix++) {
      for (let iz = -3; iz <= 3; iz++) {
        const nx = Math.max(ix * 2, Math.min(0.5, (ix + 1) * 2))
        const nz = Math.max(iz * 2, Math.min(0.5, (iz + 1) * 2))
        if (Math.hypot(nx - 0.5, nz - 0.5) <= 3) want.add(keyOf(ix, iz))
      }
    }
    expect(new Set(l.engine.tiles.keys())).toEqual(want)
  })

  it('over the count, lays the nearest ones, the same ones every time', () => {
    const layNearest = (): number[] => {
      const l = lab({ blastGroundTiles: 5 })
      l.system.layGroundAt(0.3, 0.2, 20)
      l.system.update(FRAME)
      return [...l.engine.tiles.keys()].sort((a, b) => a - b)
    }
    const first = layNearest()
    expect(first).toHaveLength(5)
    expect(layNearest()).toEqual(first)
    // the tile the blast is in is one of them, and every one is within 2 m of the centre
    expect(first).toContain(keyOf(0, 0))
    for (const key of first) {
      const ix = Math.floor(key / KEY) - ORIGIN
      const iz = (key % KEY) - ORIGIN
      const nx = Math.max(ix * 2, Math.min(0.3, (ix + 1) * 2))
      const nz = Math.max(iz * 2, Math.min(0.2, (iz + 1) * 2))
      expect(Math.hypot(nx - 0.3, nz - 0.2)).toBeLessThan(2)
    }
  })

  it('a count of zero lays nothing at a blast', () => {
    const l = lab({ blastGroundTiles: 0 })
    l.system.layGroundAt(0, 0, 10)
    l.system.update(FRAME)
    expect(l.engine.tiles.size).toBe(0)
  })

  it('a tile in reach that the terrain changed is laid again, with the crater, in the same update; one the blast does not reach is left marked', () => {
    const l = lab()
    l.system.layGroundAt(0.5, 0.5, 1)
    l.system.update(FRAME)
    expect(l.engine.tiles.get(keyOf(0, 0))!.slab).toBe(true)
    // the blast digs where it is, and a far tile is marked by an unrelated change
    l.terrain.dig({ x: 0.5, z: 0.5, depth: 0.2 })
    expect(l.engine.tiles.get(keyOf(0, 0))!.dirty).not.toBeNull()
    l.system.layGroundAt(0.5, 0.5, 1)
    l.system.update(FRAME)
    const tile = l.engine.tiles.get(keyOf(0, 0))!
    expect(tile.dirty).toBeNull()
    expect(tile.slab).toBe(false)
  })

  it('the renderer tells the system at an explosion', () => {
    const terrain = createTerrain({ bounds: [-40, -40, 40, 40], cellSize: 0.1, layout: { surface: 'dirt' } })
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, {
      physics: physicsOption(),
      scene: new THREE.Scene(),
      world: world.asWorld(),
      groundAt: (x, z) => terrain.heightAt(x, z),
      terrainRangeAt: (a, b, c, d) => terrain.heightRange(a, b, c, d),
    })
    const engine = (renderer as unknown as { pieceSys: { engine: Engine } }).pieceSys.engine
    renderer.explode([1, 0.5, 1], 400_000, 4)
    renderer.update(FRAME)
    // a 4 m disc around (1, 1): 2 m tiles touching it
    expect(engine.tiles.size).toBeGreaterThanOrEqual(4)
    expect(engine.tiles.has(keyOf(0, 0))).toBe(true)
  })
})

describe.skipIf(!IS_JOLT)('the notices of one frame lay a tile once (T3.8ad)', () => {
  it('twenty notices over the same nine tiles, then one update with a piece over them: each tile is laid at most once', () => {
    const l = lab({ blastGroundTiles: 0 })
    for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) l.engine.layTile(keyOf(ix, iz), ix, iz, undefined)
    const root = new THREE.Object3D()
    root.position.set(0, 0.2, 0)
    l.system.create('plate', root, [0.1, 0.02, 0.1], new THREE.Vector3(), 2)
    l.system.update(FRAME)
    const lay = vi.spyOn(l.engine, 'layTile')
    for (let k = 0; k < 20; k++) l.engine.groundChanged(-1.5 + (k % 5) * 0.75, -1.5 + Math.floor(k / 5) * 0.75, 0.4)
    l.system.update(FRAME)
    const laid = lay.mock.calls.map((call) => call[0])
    expect(new Set(laid).size).toBe(laid.length)
    expect(laid.length).toBeGreaterThan(0)
    for (const tile of l.engine.tiles.values()) expect(tile.dirty).toBeNull()
  })

  it('two notices in one tile mark one rectangle that holds both', () => {
    const l = lab({ blastGroundTiles: 0 })
    l.engine.layTile(keyOf(0, 0), 0, 0, undefined)
    l.engine.groundChanged(0.5, 0.5, 0.1)
    l.engine.groundChanged(1.5, 1.4, 0.1)
    const dirty = l.engine.tiles.get(keyOf(0, 0))!.dirty as { minX: number; maxX: number; minZ: number; maxZ: number }
    expect(dirty.minX).toBeLessThanOrEqual(0.4)
    expect(dirty.maxX).toBeGreaterThanOrEqual(1.6)
    expect(dirty.minZ).toBeLessThanOrEqual(0.4)
    expect(dirty.maxZ).toBeGreaterThanOrEqual(1.5)
  })
})
