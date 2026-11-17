import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import type { BodyId, PhysicsWorld, RayHit } from '@adatechnology/game-physics'

import { PieceSystem } from '../src/pieces'
import { SOLID_STRIDE } from '../src/engine-ground-solid'
import { IS_JOLT, physicsOption } from './setup-physics'

/**
 * T3.8ag: the solid under a crater tile is boxes, no hull: made again when its heights change, the same solid as one made from nothing; nothing leaks. Jolt only.
 */
interface Engine {
  world: PhysicsWorld & { J: { ConvexHullShapeSettings: { prototype: { Create(): unknown } } } }
  tiles: Map<number, { ground: BodyId; solid: BodyId | null; volume: { boxes: readonly number[] } }>
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

describe.skipIf(!IS_JOLT)('the solid under a crater tile is boxes (T3.8ag)', () => {
  it('a crater tile and a second crater on its rim make no convex hull, and the solid made again is the one a fresh tile has, to the bit', () => {
    const probe = lab(0)
    const made = vi.spyOn(probe.engine.world.J.ConvexHullShapeSettings.prototype, 'Create')
    const l = lab(0)
    l.engine.layTile(TILE_KEY, 0, 0, undefined)
    expect(l.engine.tiles.get(TILE_KEY)!.volume.boxes.length / SOLID_STRIDE).toBeGreaterThan(50)
    l.state.depth = 0.15
    l.engine.groundChanged(1.9, 1, 0.3)
    l.engine.layTile(TILE_KEY, 0, 0, l.engine.tiles.get(TILE_KEY))
    expect(made.mock.calls.length).toBe(0)
    made.mockRestore()
    const fresh = lab(0.15)
    fresh.engine.layTile(TILE_KEY, 0, 0, undefined)
    expect(solidSurface(l)).toEqual(solidSurface(fresh))
  })

  it('boxes come to rest on the crater\'s height field, none in the net under it', () => {
    const l = lab(0.15)
    l.engine.layTile(TILE_KEY, 0, 0, undefined)
    const world = l.engine.world as unknown as PhysicsWorld & { partners: Map<number, Map<number, number>> }
    const solid = l.engine.tiles.get(TILE_KEY)!.solid!
    const spots: Array<[number, number]> = [[1, 1], [1.3, 1.1], [0.7, 0.8], [1.9, 1], [1.75, 1.15], [1.2, 0.6]]
    const ids = spots.map(([x, z], i) => world.createBody({ shape: { kind: 'box', half: [0.04, 0.03, 0.05] }, motion: 'dynamic', mass: 0.4, position: [x, groundOf(0.15)(x, z) + 0.12, z], rotation: [0, Math.sin(i / 2), 0, Math.cos(i / 2)], user: i + 1 }))
    for (let frame = 0; frame < 240; frame++) world.step(1 / 60)
    const pose = new Float64Array(7)
    const away = new Float64Array(3)
    const net = new Set([solid])
    const sunk: number[] = []
    for (const id of ids) {
      world.readPose(id, pose, 0)
      expect(world.isSleeping(id)).toBe(true)
      // at rest on the surface: in no block of the net, and its centre above the ground under it
      expect(world.penetration(id, away, net)).toBe(0)
      expect(pose[1]! - groundOf(0.15)(pose[0]!, pose[2]!)).toBeGreaterThan(0)
      sunk.push(world.penetration(id, away))
    }
    // how deep each rests in the fixed things (the height field): a contact's sink, a few millimetres at most
    expect(Math.max(...sunk)).toBeLessThan(0.004)
    if (process.env.NET_REPORT) console.log('NET sunk', JSON.stringify(sunk))
  })

  /**
   * A 3 cm box wholly under the wall, its top 1 cm down (ground raised under it, a tunnel): the net close under the slope pushes it up through the surface. The flat boxes of the
   * first take (their top at the block's lowest ground) left it buried 1.5 cm down, and the prisms before them let it through to fall for good (42 m); a box this size 2 cm down,
   * or one of 8 to 16 cm on this 38° wall, is pushed out sideways by the engine (its shortest way out) and stays under on all three.
   */
  it('a small box made 1 cm under the surface of the crater wall ends above the surface: the net under the slope pushes it back up', () => {
    const l = lab(0.15)
    l.engine.layTile(TILE_KEY, 0, 0, undefined)
    const world = l.engine.world
    const ground = groundOf(0.15)
    // on the wall of the big crater (centre (1, 1), radius 0.6, 0.3 deep): its steepest ring, 0.3 m out
    const spots: Array<[number, number]> = [[1.3, 1], [1, 1.3], [0.79, 0.79], [1.25, 0.75]]
    const half = 0.015
    const ids = spots.map(([x, z], i) => world.createBody({ shape: { kind: 'box', half: [half, half, half] }, motion: 'dynamic', mass: 0.05, position: [x, ground(x, z) - 0.01 - half, z], user: i + 1 }))
    for (let frame = 0; frame < 180; frame++) world.step(1 / 60)
    const pose = new Float64Array(7)
    for (const id of ids) {
      world.readPose(id, pose, 0)
      expect(pose[1]! - ground(pose[0]!, pose[2]!)).toBeGreaterThan(0)
    }
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
    for (let k = 6; k < 206; k++) round(k)
    expect(l.engine.world.bodyCount).toBe(bodies)
    expect(Math.abs(l.engine.world.memoryInUse() - bytes)).toBeLessThan(4096)
  })
})
