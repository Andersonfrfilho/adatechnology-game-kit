import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import type { BodyId, PhysicsWorld, RayHit } from '@adatechnology/game-physics'

import { PieceSystem } from '../src/pieces'
import { SOLID_MARGIN, SOLID_STRIDE } from '../src/engine-ground-solid'
import { IS_JOLT, physicsOption } from './setup-physics'

/**
 * T3.8ag: the solid under a crater tile is boxes, no hull: made again when its heights change, the same solid as one made from nothing; nothing leaks. Jolt only.
 */
interface Engine {
  world: PhysicsWorld & { J: { ConvexHullShapeSettings: { prototype: { Create(): unknown } } } }
  tiles: Map<number, { ground: BodyId; solid: BodyId | null; volume: { boxes: readonly number[]; ring: readonly number[] }; heights: Float32Array }>
  layTile(key: number, ix: number, iz: number, tile: unknown): void
  groundChanged(x: number, z: number, radius: number): void
}

/** The deepest (m) a box's top may rest under the wall's surface once the net holds it: on a turned box close under the slope, or in a wedge between two on the tile's floor. */
const HELD_UNDER = 0.2
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
   * Boxes made wholly under the crater's wall (ground raised under them, a tunnel), over a sweep of spots, sizes and depths: the net holds every one (none falls, none rests
   * further under the surface than `HELD_UNDER`); how many it pushes back up through the surface is measured, not asserted (T3.8ag: the engine pushes a body out its shortest
   * way, up through a top close under a slope, sideways out of a deeper one). `NET_REPORT=1` prints the rate.
   */
  it('a box made under the crater wall, any spot, size or depth, is held by the net: it never falls, and rests close under the surface or above it', () => {
    const ground = groundOf(0.15)
    const l0 = lab(0.15)
    l0.engine.layTile(TILE_KEY, 0, 0, undefined)
    // on the wall of the big crater (centre (1, 1), radius 0.6, 0.3 deep): its steepest ring, 0.3 m out
    const spots: Array<[number, number]> = [[1.3, 1], [1, 1.3], [0.79, 0.79], [1.25, 0.75]]
    const rows: Array<{ half: number; depth: number; under: number; bottom: number }> = []
    for (const half of [0.015, 0.04, 0.08]) {
      for (const depth of [0.005, 0.01, 0.02, 0.04]) {
        const l = lab(0.15)
        l.engine.layTile(TILE_KEY, 0, 0, undefined)
        const world = l.engine.world
        const ids = spots.map(([x, z], i) => world.createBody({ shape: { kind: 'box', half: [half, half, half] }, motion: 'dynamic', mass: 0.05, position: [x, ground(x, z) - depth - half, z], user: i + 1 }))
        for (let frame = 0; frame < 180; frame++) world.step(1 / 60)
        const pose = new Float64Array(7)
        for (const id of ids) {
          world.readPose(id, pose, 0)
          // how far the box's top is under the surface over its centre (negative: above it)
          rows.push({ half, depth, under: ground(pose[0]!, pose[2]!) - (pose[1]! + half), bottom: pose[1]! - half })
        }
      }
    }
    const pushed = rows.filter((r) => r.under < 0).length
    if (process.env.NET_REPORT) console.log('NET pushed up', `${pushed}/${rows.length}`, JSON.stringify(rows.map((r) => [r.half, r.depth, Math.round(r.under * 1000) / 1000])))
    // the tile's floor (its lowest ground less SOLID_MARGIN) is the deepest a box goes: none falls through the solid's bottom, and one wedged between two turned boxes
    // rests with its centre over the floor's top (the 16 cm boxes made 4 cm under sink up to 5.8 cm into it, at rest: the same after 600 frames)
    const floor = Math.min(...l0.engine.tiles.get(TILE_KEY)!.heights) - SOLID_MARGIN
    if (process.env.NET_REPORT) console.log('NET under the floor', JSON.stringify(rows.map((r) => [r.half, r.depth, Math.round((floor - r.bottom) * 1000) / 1000]).filter((x) => x[2] > 0)))
    for (const r of rows) {
      expect(r.under).toBeLessThan(HELD_UNDER)
      expect(r.bottom + r.half).toBeGreaterThan(floor)
    }
  })

  it('a dig just past the tile, where its edge boxes lean but none of its own samples are, makes its net again: the one a fresh tile has over the dug ground', () => {
    // the ground rises toward the edge at x = 2, so the boxes there lean past it (SOLID_RING); the pit (x 2.02 to 2.14) is all past the edge
    const dug = (depth: number) => (x: number, z: number): number => 0.3 * x + crater(2.08, 1, 0.06, depth)(x, z)
    const made = (depth: number) => {
      const state = { depth }
      const system = new PieceSystem(THREE, { physics: physicsOption(), groundAt: (x, z) => dug(state.depth)(x, z), gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene() })
      const engine = (system as unknown as { engine: Engine }).engine
      engine.layTile(TILE_KEY, 0, 0, undefined)
      return { state, engine }
    }
    const l = made(0)
    const before = l.engine.tiles.get(TILE_KEY)!.volume
    expect(before.ring.length).toBeGreaterThan(0)
    // a change further than SOLID_RING from the tile leaves it alone
    l.state.depth = 0.4
    l.engine.groundChanged(2.5, 1, 0.06)
    l.engine.layTile(TILE_KEY, 0, 0, l.engine.tiles.get(TILE_KEY))
    expect(l.engine.tiles.get(TILE_KEY)!.volume).toBe(before)
    l.engine.groundChanged(2.08, 1, 0.06)
    l.engine.layTile(TILE_KEY, 0, 0, l.engine.tiles.get(TILE_KEY))
    const after = l.engine.tiles.get(TILE_KEY)!.volume
    expect(after.boxes).not.toEqual(before.boxes)
    expect(after.boxes).toEqual(made(0.4).engine.tiles.get(TILE_KEY)!.volume.boxes)
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
