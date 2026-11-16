import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import type { BodyId, PhysicsWorld, RayHit } from '@adatechnology/game-physics'

import { PieceSystem } from '../src/pieces'
import { IS_JOLT, physicsOption } from './setup-physics'

/**
 * T3.8ad: the solid under a crater tile is made again when its heights change, from the hulls it already had where the ground did not move. Same solid as one made from nothing;
 * nothing leaks. Jolt only.
 */
interface Engine {
  world: PhysicsWorld & { hulls: Map<number, { readonly size: number }>; J: { ConvexHullShapeSettings: { prototype: { Create(): unknown } } } }
  tiles: Map<number, { ground: BodyId; solid: BodyId | null; volume: { prisms: readonly number[]; boxes: readonly number[] } }>
  layTile(key: number, ix: number, iz: number, tile: unknown): void
  groundChanged(x: number, z: number, radius: number): void
}

const KEY = 65536
const ORIGIN = 32768
const TILE_KEY = ORIGIN * KEY + ORIGIN

const rolling = (x: number, z: number): number => 0.01 * Math.sin(2 * x) * Math.sin(2 * z)
const crater = (cx: number, cz: number, radius: number, depth: number) => (x: number, z: number): number => {
  const d = Math.hypot(x - cx, z - cz)
  return d >= radius ? 0 : -depth * Math.cos((Math.PI / 2) * (d / radius)) ** 2
}
const groundOf = (depth: number) => (x: number, z: number): number => rolling(x, z) + crater(1, 1, 0.6, 0.3)(x, z) + crater(1.9, 1, 0.3, depth)(x, z)

const lab = (depth: number) => {
  const state = { depth }
  const system = new PieceSystem(THREE, { physics: physicsOption(), groundAt: (x, z) => groundOf(state.depth)(x, z), gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene() })
  return { state, engine: (system as unknown as { engine: Engine }).engine }
}
type Lab = ReturnType<typeof lab>

/** The top of the solid under the tile by rays down a lattice off every cell edge: where the solid's own body is. */
const solidSurface = (l: Lab): number[] => {
  const solid = l.engine.tiles.get(TILE_KEY)!.solid
  const out: number[] = []
  const hits: RayHit[] = []
  for (let z = 0.013; z < 2; z += 0.083) {
    for (let x = 0.013; x < 2; x += 0.083) {
      hits.length = 0
      l.engine.world.rayAll([x, 5, z], [0, -1, 0], 10, hits)
      const hit = hits.find((h) => h.body === solid)
      out.push(hit ? 5 - hit.distance : NaN)
    }
  }
  return out
}

describe.skipIf(!IS_JOLT)('the solid under a crater tile reuses the hulls the ground did not change (T3.8ad)', () => {
  it('a second crater on the rim makes only the hulls it changed, and the solid is the one a fresh tile has, to the bit', () => {
    const l = lab(0)
    l.engine.layTile(TILE_KEY, 0, 0, undefined)
    const first = l.engine.tiles.get(TILE_KEY)!
    const prisms = first.volume.prisms.length / 24
    expect(prisms).toBeGreaterThan(50)
    expect(l.engine.world.hulls.get(first.solid!)!.size).toBeGreaterThan(0)
    const made = vi.spyOn(l.engine.world.J.ConvexHullShapeSettings.prototype, 'Create')
    l.state.depth = 0.15
    l.engine.groundChanged(1.9, 1, 0.3)
    l.engine.layTile(TILE_KEY, 0, 0, l.engine.tiles.get(TILE_KEY))
    const afterPrisms = l.engine.tiles.get(TILE_KEY)!.volume.prisms.length / 24
    // far fewer hulls made than the solid holds: the rest are the ones from before
    expect(made.mock.calls.length).toBeLessThan(afterPrisms * 0.5)
    made.mockRestore()
    const fresh = lab(0.15)
    fresh.engine.layTile(TILE_KEY, 0, 0, undefined)
    expect(solidSurface(l)).toEqual(solidSurface(fresh))
  })

  it('the heap and the body count are the same after 200 changes of the crater', () => {
    const l = lab(0)
    l.engine.layTile(TILE_KEY, 0, 0, undefined)
    const round = (k: number): void => {
      l.state.depth = 0.05 + 0.05 * (k % 3)
      l.engine.groundChanged(1.9, 1, 0.3)
      l.engine.layTile(TILE_KEY, 0, 0, l.engine.tiles.get(TILE_KEY))
    }
    for (let k = 0; k < 6; k++) round(k)
    const bytes = l.engine.world.memoryInUse()
    const bodies = l.engine.world.bodyCount
    const solid = l.engine.tiles.get(TILE_KEY)!.solid!
    const hulls = l.engine.world.hulls.get(solid)!.size
    for (let k = 6; k < 206; k++) round(k)
    expect(l.engine.world.bodyCount).toBe(bodies)
    // the body holds the hulls of its current shape and no more: the count does not grow with the changes
    expect(l.engine.world.hulls.get(solid)!.size).toBeLessThanOrEqual(hulls + 40)
    expect(Math.abs(l.engine.world.memoryInUse() - bytes)).toBeLessThan(4096)
  })
})
