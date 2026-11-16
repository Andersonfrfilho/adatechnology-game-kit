import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { WorkBudget } from '@adatechnology/game-physics'
import type { WorkBudgetOptions } from '@adatechnology/game-physics'

import { createTerrain } from '@adatechnology/game-terrain'

import { PieceSystem } from '../src/pieces'
import type { PieceBody } from '../src/internal'
import { IS_JOLT, physicsOption } from './setup-physics'

/**
 * Spec 008 (§5 G, §7 F3/F4): under the work budget the ground a piece needs is a precondition of its moving. A piece whose tiles are not laid yet waits held still where it is
 * (drawn and solid, never falling through ground that is not there), the tiles come in a fixed order within the frame's units, and none waits past the ceiling.
 * Jolt only: the kit's own solver has no tiles.
 */
interface Engine {
  tiles: Map<number, unknown>
  fellThrough: number
}

const FRAME = 1 / 60
/** 2 m tiles: a 0.1 m box at a tile's centre with the 0.5 m margin needs that tile alone. */
const TILE = 2
const HALF: [number, number, number] = [0.1, 0.1, 0.1]
const START_Y = 1
const COSTS = { perTile: 10, perTileRead: 100, perBody: 0 }

const lab = (budget: WorkBudgetOptions | null, count: number) => {
  const terrain = createTerrain({ bounds: [-40, -40, 40, 40], cellSize: 0.1, layout: { surface: 'dirt' } })
  const work = budget ? new WorkBudget(budget) : null
  const system = new PieceSystem(THREE, {
    physics: physicsOption(),
    groundAt: (x, z) => terrain.heightAt(x, z),
    terrainRangeAt: (a, b, c, d) => terrain.heightRange(a, b, c, d),
    gravity: 9.81,
    onHardLanding: () => undefined,
    scene: new THREE.Scene(),
    ...(work ? { work: { budget: work, costs: COSTS, focus: () => [0, 0, 0] as [number, number, number], openFrame: () => work.beginFrame() } } : {}),
  })
  const pieces: PieceBody[] = []
  for (let index = 0; index < count; index++) {
    const root = new THREE.Object3D()
    // one piece over the middle of each tile along x, the nearest the focus first
    root.position.set(TILE * index + TILE / 2, START_Y, TILE / 2)
    root.updateMatrixWorld(true)
    pieces.push(system.create(`piece${String(index).padStart(2, '0')}`, root, HALF, new THREE.Vector3(), 1))
  }
  const engine = (system as unknown as { engine: Engine }).engine
  const height = (index: number): number => pieces[index]!.root.position.y
  return { system, pieces, engine, work, height, ground: terrain.heightAt(1, 1) }
}

describe.skipIf(!IS_JOLT)('the ground under the pieces under the work budget (spec 008, G)', () => {
  it('a piece whose ground waits stays exactly where it was, then falls onto the ground once it is laid', () => {
    // 10 units a frame: one level tile
    const l = lab({ budgetMs: 0.1, unitsPerMs: 100, maxWaitFrames: 12 }, 3)
    l.system.update(FRAME)
    expect(l.engine.tiles.size).toBe(1)
    expect(l.height(0)).toBeLessThan(START_Y)
    expect(l.height(1)).toBe(START_Y)
    expect(l.height(2)).toBe(START_Y)
    expect(l.pieces[1]!.velocity).toEqual([0, 0, 0])
    l.system.update(FRAME)
    expect(l.engine.tiles.size).toBe(2)
    expect(l.height(1)).toBeLessThan(START_Y)
    expect(l.height(2)).toBe(START_Y)
    for (let frame = 0; frame < 120; frame++) l.system.update(FRAME)
    expect(l.engine.tiles.size).toBe(3)
    for (let index = 0; index < 3; index++) expect(l.height(index)).toBeCloseTo(l.ground + HALF[1], 1)
    expect(l.engine.fellThrough).toBe(0)
  })

  it('with no units at all, the ceiling still lays every piece its ground by its maxWaitFrames-th frame', () => {
    const l = lab({ budgetMs: 0, maxWaitFrames: 3 }, 6)
    const laid: number[] = []
    for (let frame = 0; frame < 3; frame++) {
      l.system.update(FRAME)
      laid.push(l.engine.tiles.size)
    }
    // one a frame (at least one goes), then the ceiling takes the other four
    expect(laid).toEqual([1, 2, 6])
    l.system.update(FRAME)
    for (let index = 0; index < 6; index++) expect(l.height(index)).toBeLessThan(START_Y)
  })

  it('a burst of tiles is spread over frames within the units of each frame', () => {
    // 30 units: three level tiles a frame
    const l = lab({ budgetMs: 0.3, unitsPerMs: 100, maxWaitFrames: 12 }, 10)
    const perFrame: number[] = []
    let before = 0
    for (let frame = 0; frame < 4; frame++) {
      l.system.update(FRAME)
      expect(l.work!.spent('ground')).toBeLessThanOrEqual(l.work!.unitsPerFrame)
      perFrame.push(l.engine.tiles.size - before)
      before = l.engine.tiles.size
    }
    expect(perFrame).toEqual([3, 3, 3, 1])
  })

  it('off, every tile is laid in the update that needs it; with units for all of them the pieces move the very same, bit for bit', () => {
    const off = lab(null, 6)
    off.system.update(FRAME)
    expect(off.engine.tiles.size).toBe(6)
    const ample = lab({ budgetMs: 1000 }, 6)
    for (let frame = 0; frame < 60; frame++) {
      if (frame > 0) off.system.update(FRAME)
      ample.system.update(FRAME)
    }
    const poses = (l: ReturnType<typeof lab>): number[][] => l.pieces.map((b) => [...b.root.position.toArray(), ...b.root.quaternion.toArray(), ...b.velocity])
    expect(poses(ample)).toEqual(poses(off))
  })

  it('the waits save as data; a system rebuilt to the same frame and given them goes on as the first, and one that lost them still holds the pieces', () => {
    const options = { budgetMs: 0, maxWaitFrames: 2 }
    const first = lab(options, 4)
    first.system.update(FRAME)
    const saved = first.system.saveGroundWaits()
    expect(JSON.parse(JSON.stringify(saved))).toEqual(saved)
    expect(saved).toEqual([['piece01', 1], ['piece02', 1], ['piece03', 1]])
    const rebuilt = lab(options, 4)
    rebuilt.system.update(FRAME)
    rebuilt.system.restoreGroundWaits([])
    rebuilt.system.restoreGroundWaits(saved)
    const lost = lab(options, 4)
    lost.system.update(FRAME)
    lost.system.restoreGroundWaits([])
    for (const l of [first, rebuilt, lost]) l.system.update(FRAME)
    // the saved waits reach the ceiling in this frame: every tile is laid, in both
    expect(first.engine.tiles.size).toBe(4)
    expect(rebuilt.engine.tiles.size).toBe(4)
    // lost waits start again from nothing: one more piece goes, the others still wait held where they were, none falls through
    expect(lost.engine.tiles.size).toBe(2)
    expect(lost.height(3)).toBe(START_Y)
  })
})
