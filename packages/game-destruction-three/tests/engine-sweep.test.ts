import * as THREE from 'three'
import type { Vec3 } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import type { StaticSolid } from '../src/engine-pieces'
import { PieceSystem } from '../src/pieces'
import type { PieceSweepHit, PieceSystemOptions } from '../src/pieces'

const DT = 0.05
/** A fixed box (a table, 80 cm high) whose near face is at x = 0.8. */
const TABLE: readonly StaticSolid[] = [{ center: [1, 0.4, 0], half: [0.2, 0.4, 0.3], rotation: [0, 0, 0, 1] }]

/**
 * The sweep as the room's door met the table edge: the kit's sweep is a cube about the centre of mass, not the piece's shape, so beside a fixed thing it reports the
 * thing's edge (a normal up and away from it) on a way the engine's body never collides on. Every downward move beside the table is reported, met at its start.
 */
const edgeBeside = (_piece: unknown, from: Vec3, to: Vec3): PieceSweepHit | null =>
  to[1] >= from[1] ? null : { object: 'table', part: 'top', distance: 0, point: [0.8, from[1], from[2]], normal: [-0.8, 0.6, 0] }

/** A 20 cm box 5 cm beside the table face, its bottom 40 cm over the floor, dropped: its centre each update for 2 s, and when it fell asleep. */
const drop = (solids: ReadonlyMap<string, readonly StaticSolid[]>, sweep?: typeof edgeBeside): { path: number[][]; asleepAt: number } => {
  const options: PieceSystemOptions = { groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene(), staticSolids: () => solids }
  if (sweep) options.sweep = sweep
  const system = new PieceSystem(THREE, options)
  const root = new THREE.Object3D()
  root.position.set(0.65, 0.5, 0)
  const box = system.create('box', root, [0.1, 0.1, 0.1], new THREE.Vector3(), 2)
  const path: number[][] = []
  let asleepAt = -1
  for (let i = 0; i < 40; i++) {
    system.update(DT)
    path.push([root.position.x, root.position.y, root.position.z])
    if (box.sleeping && asleepAt < 0) asleepAt = (i + 1) * DT
  }
  return { path, asleepAt }
}

const furthest = (a: number[][], b: number[][]): number => Math.max(...a.map((p, i) => Math.hypot(p[0]! - b[i]![0]!, p[1]! - b[i]![1]!, p[2]! - b[i]![2]!)))

describe('the kit sweep and what the engine has', () => {
  it('a hit on a fixed thing the engine has moves nothing: the piece falls as if there were no sweep, lands and sleeps', () => {
    const solids = new Map([['table', TABLE]])
    const swept = drop(solids, edgeBeside)
    const free = drop(solids)
    expect(furthest(swept.path, free.path)).toBeLessThan(1e-6)
    expect(swept.path.at(-1)![1]).toBeCloseTo(0.1, 2)
    expect(swept.asleepAt).toBeGreaterThan(0)
    expect(swept.asleepAt).toBeLessThan(2)
  })

  it('a hit on a wall the engine does not have still stops the piece where it met it', () => {
    const swept = drop(new Map(), edgeBeside)
    const free = drop(new Map())
    expect(furthest(swept.path, free.path)).toBeGreaterThan(0.05)
  })
})
