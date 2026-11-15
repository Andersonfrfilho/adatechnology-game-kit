import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import type { PhysicsWorld } from '@adatechnology/game-physics'

import type { GroundBounds } from '../src/engine-pieces'
import { PieceSystem } from '../src/pieces'
import { IS_JOLT, physicsOption } from './setup-physics'

/** A built area of 32 m (the diagonal of it is the 45 m wire's length), on ground that is never level: every tile is a height field with its solid. */
const AREA: GroundBounds = { minX: 0, minZ: 0, maxX: 32, maxZ: 32 }
const rolling = (x: number, z: number): number => 0.01 * Math.sin(2 * x) * Math.sin(2 * z)

interface Scene {
  readonly system: PieceSystem
  readonly world: PhysicsWorld
  readonly ground: { at: (x: number, z: number) => number }
  /** Ground bodies made and shapes swapped since the world was made, by what `createBody`/`setShape` were called with. */
  readonly made: { statics: number; reshaped: number }
}

const engineOf = (system: PieceSystem): { tiles: Map<number, unknown>; fellThrough: number; world: PhysicsWorld } =>
  (system as unknown as { engine: { tiles: Map<number, unknown>; fellThrough: number; world: PhysicsWorld } }).engine

const sceneOf = (): Scene => {
  const ground = { at: rolling }
  const system = new PieceSystem(THREE, { physics: physicsOption(), groundAt: (x, z) => ground.at(x, z), gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene() })
  const world = engineOf(system).world
  const made = { statics: 0, reshaped: 0 }
  const createBody = world.createBody.bind(world)
  const setShape = world.setShape.bind(world)
  world.createBody = (desc) => {
    if (desc.motion === 'static') made.statics++
    return createBody(desc)
  }
  world.setShape = (id, shape) => {
    made.reshaped++
    return setShape(id, shape)
  }
  return { system, world, ground, made }
}

/** What a hammer or a blast wakes in the house: the two poles standing, and the wire along the diagonal, lying (the pieces of the room's rounds). */
const wakeThePieces = (system: PieceSystem): void => {
  const pole = (x: number, z: number): void => {
    const root = new THREE.Object3D()
    root.position.set(x, 3.8, z)
    root.rotation.z = 0.4
    system.create(`pole:${x}`, root, [0.11, 3.75, 0.8], new THREE.Vector3(), 950)
  }
  pole(6, 10)
  pole(26, 20)
  const wire = new THREE.Object3D()
  wire.position.set(16, 0.5, 16)
  wire.rotation.set(0, Math.PI / 4, 0)
  system.create('wire', wire, [22.675, 0.02, 0.02], new THREE.Vector3(), 12)
}

const run = (system: PieceSystem, frames: number): number[] => {
  const costs: number[] = []
  for (let i = 0; i < frames; i++) {
    const start = performance.now()
    system.update(1 / 60)
    costs.push(performance.now() - start)
  }
  return costs
}

describe.skipIf(!IS_JOLT)('ground laid when the area is built', () => {
  it('lays the tiles of the area and its margin, and the ones already there are left alone', () => {
    const { system } = sceneOf()
    const laid = system.prelayGround({ ...AREA, margin: 0 })
    // 32 m / 2 m tiles, 16 each way, plus one for the tile the far edge falls on
    expect(laid).toBe(17 * 17)
    expect(engineOf(system).tiles.size).toBe(laid)
    expect(system.prelayGround({ ...AREA, margin: 0 })).toBe(0)
    // the default margin reaches past the walls (4 m = 2 tiles each side)
    expect(system.prelayGround(AREA)).toBe(21 * 21 - 17 * 17)
  })

  it('a wake over the built area makes no ground body, where without the pre-lay it makes hundreds (D8), and nothing falls through', () => {
    const lazy = sceneOf()
    wakeThePieces(lazy.system)
    run(lazy.system, 60)
    expect(lazy.made.statics).toBeGreaterThan(100)

    const built = sceneOf()
    built.system.prelayGround(AREA)
    const bodies = built.world.bodyCount
    const madeByBuild = built.made.statics
    expect(madeByBuild).toBeGreaterThan(300)
    wakeThePieces(built.system)
    run(built.system, 60)
    expect(built.made.statics).toBe(madeByBuild)
    expect(engineOf(built.system).fellThrough).toBe(0)
    expect(engineOf(lazy.system).fellThrough).toBe(0)
    // the three pieces are the only bodies it gained
    expect(built.world.bodyCount).toBe(bodies + 3)
  })

  it('ground outside the built area is still laid when a piece reaches it, along a fast piece\'s path too', () => {
    const { system, made } = sceneOf()
    system.prelayGround(AREA)
    const before = made.statics
    const chip = new THREE.Object3D()
    chip.position.set(40, 1, 16)
    const piece = system.create('chip', chip, [0.05, 0.05, 0.05], new THREE.Vector3(), 0.3)
    piece.velocity[0] = 60
    system.update(1 / 60)
    expect(made.statics).toBeGreaterThan(before)
    const tiles = engineOf(system).tiles
    const laid = (x: number, z: number): boolean => tiles.has((Math.floor(x / 2) + 32768) * 65536 + (Math.floor(z / 2) + 32768))
    expect(laid(40, 16) && laid(41.5, 16)).toBe(true)
    expect(laid(100, 16)).toBe(false)
  })

  it('a dug tile of the built area is laid again, as one made lazily is', () => {
    const { system, ground, made } = sceneOf()
    system.prelayGround(AREA)
    const root = new THREE.Object3D()
    root.position.set(10.3, 0.3, 10.3)
    system.create('plate', root, [0.3, 0.02, 0.3], new THREE.Vector3(), 3)
    run(system, 30)
    const reshaped = made.reshaped
    ground.at = (x, z) => rolling(x, z) - 0.2 * Math.exp(-(((x - 10.3) / 0.8) ** 2 + ((z - 10.3) / 0.8) ** 2))
    system.wakeRegion(10.3, 10.3, 1.5)
    run(system, 30)
    expect(made.reshaped).toBeGreaterThan(reshaped)
    expect(root.position.y).toBeLessThan(0.3)
    expect(engineOf(system).fellThrough).toBe(0)
  })

  it('clearing the system removes the pre-laid ground: every body it made is gone (§8)', () => {
    const { system, world } = sceneOf()
    const empty = world.bodyCount
    const laid = system.prelayGround(AREA)
    expect(world.bodyCount).toBeGreaterThanOrEqual(empty + laid)
    system.clear()
    expect(world.bodyCount).toBe(empty)
    expect(engineOf(system).tiles.size).toBe(0)
    // and it can be laid again, the same
    expect(system.prelayGround(AREA)).toBe(laid)
    system.clear()
    expect(world.bodyCount).toBe(empty)
  })

  it('the kit\'s own solver has no ground bodies to lay', () => {
    const system = new PieceSystem(THREE, { physics: 'own', groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene() })
    expect(system.prelayGround(AREA)).toBe(0)
  })
})

// PROFILE=1: the cost of the wake frames, without and with the pre-lay (the room's numbers are on the page; this is the JS and the engine in Node)
describe.runIf(IS_JOLT && process.env.PROFILE === '1')('wake cost with and without the pre-lay', () => {
  it('prints the build cost and the first wake updates', { timeout: 600000 }, () => {
    const rows: Record<string, number[]> = { lazyFirst: [], lazyMax: [], lazyTotal: [], builtFirst: [], builtMax: [], builtTotal: [], buildMs: [] }
    for (let i = 0; i < Number(process.env.PROFILE_RUNS ?? 5); i++) {
      const lazy = sceneOf()
      wakeThePieces(lazy.system)
      const lazyCosts = run(lazy.system, 40)
      rows.lazyFirst?.push(lazyCosts[0] ?? 0)
      rows.lazyMax?.push(Math.max(...lazyCosts))
      rows.lazyTotal?.push(lazyCosts.reduce((a, b) => a + b, 0))
      const built = sceneOf()
      const start = performance.now()
      built.system.prelayGround(AREA)
      rows.buildMs?.push(performance.now() - start)
      wakeThePieces(built.system)
      const builtCosts = run(built.system, 40)
      rows.builtFirst?.push(builtCosts[0] ?? 0)
      rows.builtMax?.push(Math.max(...builtCosts))
      rows.builtTotal?.push(builtCosts.reduce((a, b) => a + b, 0))
    }
    const mid = (v: number[]): number => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] ?? 0
    process.stderr.write(`wake-profile ${JSON.stringify(Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, { median: +mid(v).toFixed(2), runs: v.map((x) => +x.toFixed(2)) }])))}\n`)
  })
})
