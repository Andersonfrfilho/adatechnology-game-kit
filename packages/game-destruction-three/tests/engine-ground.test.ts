import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import type { BodyId, PhysicsWorld, RayHit } from '@adatechnology/game-physics'

import { GROUND_CELL, buildGroundTile } from '../src/engine-ground'
import type { GroundTile } from '../src/engine-ground'
import { SOLID_DEPTH } from '../src/engine-ground-solid'
import { PieceSystem } from '../src/pieces'
import type { PieceBody } from '../src/internal'
import { IS_JOLT, physicsOption } from './setup-physics'

/** The step boxes as min x, max x, min z, max z, top. */
const boxesOf = (t: GroundTile): Array<[number, number, number, number, number]> => {
  const out: Array<[number, number, number, number, number]> = []
  for (let i = 0; i < t.boxes.length; i += 6) out.push([t.boxes[i] - t.boxes[i + 3], t.boxes[i] + t.boxes[i + 3], t.boxes[i + 2] - t.boxes[i + 5], t.boxes[i + 2] + t.boxes[i + 5], t.boxes[i + 1] + t.boxes[i + 4]])
  return out
}

/** The height field's surface at (x, z) of a tile from (x0, z0): bilinear over its cell, as the engine's two triangles are within a few mm on these grounds. */
const fieldAt = (t: GroundTile, x0: number, z0: number, size: number, x: number, z: number): number => {
  const c = size / t.cells
  const m = t.cells + 1
  const i = Math.min(t.cells - 1, Math.floor((x - x0) / c))
  const j = Math.min(t.cells - 1, Math.floor((z - z0) / c))
  const u = (x - x0) / c - i
  const v = (z - z0) / c - j
  const h = (a: number, b: number): number => t.heights[(j + b) * m + i + a]
  return h(0, 0) * (1 - u) * (1 - v) + h(1, 0) * u * (1 - v) + h(0, 1) * (1 - u) * v + h(1, 1) * u * v
}

// the tests of the triangle ground this replaced (vertical faces, one-sided walls toward the low side) are rewritten for a height field plus solid step boxes:
// the same promises — a step stays a step where it is, never a ramp; a smooth bowl stays smooth; a step on a tile's border is made once — on the new shapes
describe('engine ground', () => {
  it('keeps a slab edge a solid box within half a cell of where it is, and no ramp of the height field sticks out of the ground', () => {
    const groundAt = (x: number): number => (x >= 0.53 ? 0.2 : 0)
    const t = buildGroundTile(groundAt, 0, 0, 1)
    const high = boxesOf(t).filter((b) => Math.abs(b[4] - 0.2) < 1e-9)
    expect(high.length).toBeGreaterThan(0)
    expect(Math.abs(Math.min(...high.map((b) => b[0])) - 0.53)).toBeLessThanOrEqual(GROUND_CELL / 2)
    for (let x = 0.0005; x < 1; x += 0.0025) {
      const z = 0.5
      const above = fieldAt(t, 0, 0, 1, x, z) - groundAt(x)
      if (above <= 1e-3) continue
      // a height field ramp above the true ground is only ever inside a box that reaches as high
      expect(boxesOf(t).some((b) => x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3] && b[4] >= groundAt(x) + above - 1e-3)).toBe(true)
    }
  })

  it('a smooth bowl has no step boxes and its height field is the ground at every corner', () => {
    const groundAt = (x: number, z: number): number => {
      const d = Math.hypot(x, z)
      return d < 1.2 ? -0.45 * (1 - (d / 1.2) ** 2) : 0
    }
    const t = buildGroundTile(groundAt, -1, -1, 2)
    expect(t.boxes).toHaveLength(0)
    expect(t.level).toBeNull()
    const m = t.cells + 1
    for (let j = 0; j < m; j += 7) for (let i = 0; i < m; i += 7) expect(t.heights[j * m + i]).toBeCloseTo(groundAt(-1 + (i * 2) / t.cells, -1 + (j * 2) / t.cells), 5)
  })

  it('level ground is a level tile (a slab)', () => {
    expect(buildGroundTile(() => 0.3, 0, 0, 2).level).toBe(0.3)
  })
})

describe('engine ground at a tile border', () => {
  it('a table side on the line between two tiles is a box of the high tile up to the line, and the low tile has none', () => {
    const groundAt = (x: number): number => (x < 0 ? 0.78 : 0)
    const highTile = boxesOf(buildGroundTile(groundAt, -1, 0, 1)).filter((b) => Math.abs(b[4] - 0.78) < 1e-9)
    expect(highTile.length).toBeGreaterThan(0)
    expect(Math.max(...highTile.map((b) => b[1]))).toBeCloseTo(0, 9)
    expect(buildGroundTile(groundAt, 0, 0, 1).boxes).toHaveLength(0)
  })
})

/** The highest solid top under (x, z), or -Infinity: a level block's top, or a sloped block's plane at that point. */
const solidTopAt = (t: GroundTile, x: number, z: number): number => {
  let top = -Infinity
  const { boxes, prisms } = t.solid
  for (let i = 0; i < boxes.length; i += 6) {
    if (Math.abs(x - boxes[i]!) <= boxes[i + 3]! + 1e-9 && Math.abs(z - boxes[i + 2]!) <= boxes[i + 5]! + 1e-9) top = Math.max(top, boxes[i + 1]! + boxes[i + 4]!)
  }
  for (let i = 0; i < prisms.length; i += 24) {
    const [x0, x1, z0, z1] = [prisms[i]!, prisms[i + 3]!, prisms[i + 2]!, prisms[i + 8]!]
    if (x < x0 - 1e-9 || x > x1 + 1e-9 || z < z0 - 1e-9 || z > z1 + 1e-9) continue
    const u = (x - x0) / (x1 - x0)
    const v = (z - z0) / (z1 - z0)
    // the top is a plane: from its x0z0 corner along x and along z
    top = Math.max(top, prisms[i + 1]! + u * (prisms[i + 4]! - prisms[i + 1]!) + v * (prisms[i + 7]! - prisms[i + 1]!))
  }
  return top
}

const lowestSolid = (t: GroundTile): number => Math.min(...t.solid.boxes.filter((_, i) => i % 6 === 1).map((y, k) => y - t.solid.boxes[k * 6 + 4]!), ...t.solid.prisms.filter((_, i) => i % 24 === 13))

describe('solid under the height field', () => {
  const rolling = (x: number, z: number): number => 0.02 * Math.sin(1.7 * x) * Math.cos(1.3 * z) + 0.03 * x
  const bowl = (x: number, z: number): number => {
    const d = Math.hypot(x, z)
    return d < 1.2 ? -0.45 * (1 - (d / 1.2) ** 2) : 0
  }

  it('is under the surface everywhere, within 1 cm of it on a gentle ground, and as deep as SOLID_DEPTH under the lowest corner', () => {
    const t = buildGroundTile(rolling, 0, 0, 2)
    expect(t.solid.boxes.length + t.solid.prisms.length).toBeGreaterThan(0)
    for (let x = 0; x <= 2; x += 0.013) {
      for (let z = 0; z <= 2; z += 0.017) {
        const gap = rolling(x, z) - solidTopAt(t, x, z)
        expect(gap).toBeGreaterThan(-0.0006)
        expect(gap).toBeLessThan(0.01 + 0.0006)
      }
    }
    expect(lowestSolid(t)).toBeCloseTo(Math.min(...t.heights) - SOLID_DEPTH, 5)
  })

  it('never sticks out above a steep bowl either, and level ground has none (its slab is solid already)', () => {
    const t = buildGroundTile(bowl, -1, -1, 2)
    for (let x = -1; x <= 1; x += 0.011) for (let z = -1; z <= 1; z += 0.013) expect(solidTopAt(t, x, z)).toBeLessThanOrEqual(bowl(x, z) + 0.0006)
    expect(buildGroundTile(() => 0.3, 0, 0, 2).solid).toEqual({ boxes: [], prisms: [] })
  })

  it('follows the ground when it is dug: made again from the new heights, still within 1 cm', () => {
    let depth = 0
    const dug = (x: number, z: number): number => rolling(x, z) - depth * Math.cos((Math.PI / 2) * Math.min(1, Math.hypot(x - 1, z - 1) / 0.8)) ** 2
    const before = buildGroundTile(dug, 0, 0, 2)
    depth = 0.3
    const after = buildGroundTile(dug, 0, 0, 2)
    expect(after.solid.prisms).not.toEqual(before.solid.prisms)
    for (let x = 0.4; x <= 1.6; x += 0.02) for (let z = 0.4; z <= 1.6; z += 0.02) expect(dug(x, z) - solidTopAt(after, x, z)).toBeLessThan(0.01 + 0.0006)
    for (let x = 0; x <= 2; x += 0.02) expect(dug(x, 0.02) - solidTopAt(after, x, 0.02)).toBeLessThan(0.01 + 0.0006)
  })
})

interface Probe {
  readonly system: PieceSystem
  readonly root: THREE.Object3D
  readonly piece: PieceBody
  readonly world: PhysicsWorld
  /** The ground the system stands on: replaced by the test when the ground changes. */
  readonly ground: { at: (x: number, z: number) => number }
}

const rollingGround = (raise: number) => (x: number, z: number): number => raise + 0.01 * Math.sin(2 * x) * Math.sin(2 * z)
const HALF: [number, number, number] = [0.3, 0.02, 0.3]
const THIN = HALF[1]

/** A 4 cm thick plate on a gently rolling ground that can be raised as a whole: a height field tile, not a slab. */
const plateOnRolling = (y: number, speed = 0): Probe => {
  const ground = { at: rollingGround(0) }
  const system = new PieceSystem(THREE, { physics: physicsOption(), groundAt: (x, z) => ground.at(x, z), gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene() })
  const root = new THREE.Object3D()
  root.position.set(0.3, y, 0.3)
  const piece = system.create('plate', root, HALF, new THREE.Vector3(), 3)
  piece.velocity[1] = -speed
  return { system, root, piece, world: (system as unknown as { engine: { world: PhysicsWorld } }).engine.world, ground }
}

const fellThroughOf = (p: Probe): number => (p.system as unknown as { engine: { fellThrough: number } }).engine.fellThrough
/** The highest ground under the plate's four corners (it lies flat): where its underside rests. */
const restingTop = (p: Probe): number => Math.max(...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => p.ground.at(p.root.position.x + sx * HALF[0], p.root.position.z + sz * HALF[2]))))
const run = (p: Probe, frames: number): number => {
  let lowest = Infinity
  for (let i = 0; i < frames; i++) {
    p.system.update(1 / 60)
    lowest = Math.min(lowest, p.root.position.y)
  }
  return lowest
}

describe.skipIf(!IS_JOLT)('solid ground in the engine', () => {
  it('ground that rises 5 cm under a sleeping plate leaves it on top, never inside or under, and fellThrough stays 0', () => {
    const p = plateOnRolling(0.1)
    run(p, 240)
    expect(p.piece.sleeping).toBe(true)
    p.ground.at = rollingGround(0.05)
    p.system.wakeRegion(0.3, 0.3, 3)
    const lowest = run(p, 240)
    expect(lowest).toBeGreaterThan(restingTop(p) + THIN - 0.01)
    expect(p.root.position.y).toBeCloseTo(restingTop(p) + THIN, 1)
    expect(Math.abs(p.root.position.y - (restingTop(p) + THIN))).toBeLessThan(0.012)
    expect(fellThroughOf(p)).toBe(0)
  })

  it('the same when the host never says so: a sleeping piece looks at the ground under it and wakes when it rose', () => {
    const p = plateOnRolling(0.1)
    run(p, 240)
    p.ground.at = rollingGround(0.05)
    const lowest = run(p, 600)
    expect(lowest).toBeGreaterThan(restingTop(p) + THIN - 0.01)
    expect(Math.abs(p.root.position.y - (restingTop(p) + THIN))).toBeLessThan(0.012)
    expect(fellThroughOf(p)).toBe(0)
  })

  it('a thin plate shot down through the surface at 40 m/s ends on it, not under it', () => {
    const p = plateOnRolling(1, 40)
    const lowest = run(p, 240)
    expect(lowest).toBeGreaterThan(restingTop(p) + THIN - 0.01)
    expect(Math.abs(p.root.position.y - (restingTop(p) + THIN))).toBeLessThan(0.012)
    expect(fellThroughOf(p)).toBe(0)
  })

  it('a plate the engine finds wholly under the surface (put there directly, as a tunnelled one is) is held by the solid: it does not fall on, and fellThrough stays 0', () => {
    const p = plateOnRolling(0.1)
    run(p, 240)
    const engine = (p.system as unknown as { engine: { links: Map<PieceBody, { id: BodyId }> } }).engine
    const put = restingTop(p) - 0.04
    p.world.setPose(engine.links.get(p.piece)!.id, [0.3, put, 0.3], [0, 0, 0, 1], true)
    const lowest = run(p, 120)
    expect(lowest).toBeGreaterThan(put - 0.01)
    expect(fellThroughOf(p)).toBe(0)
  })

  it('under the height field every tile has a solid body that follows a dig: its top stays under the surface, within 1 cm, and the plate dropped into the pit lands in it', () => {
    const p = plateOnRolling(0.1)
    run(p, 240)
    const tiles = (p.system as unknown as { engine: { tiles: Map<number, { solid: BodyId | null; ground: BodyId }> } }).engine.tiles
    const solidTops = (x: number, z: number): number[] => {
      const hits: RayHit[] = []
      p.world.rayAll([x, 3, z], [0, -1, 0], 6, hits)
      const solids = new Set([...tiles.values()].map((t) => t.solid))
      return hits.filter((h) => solids.has(h.body)).map((h) => 3 - h.distance)
    }
    const before = solidTops(0.7, 0.9)
    expect(before.length).toBeGreaterThan(0)
    // dug 20 cm deep around (0.7, 0.9): under the plate, which wakes
    const dug = (x: number, z: number): number => rollingGround(0)(x, z) - 0.2 * Math.cos((Math.PI / 2) * Math.min(1, Math.hypot(x - 0.7, z - 0.9) / 1)) ** 2
    p.ground.at = dug
    p.system.wakeRegion(0.7, 0.9, 1.2)
    run(p, 120)
    const after = solidTops(0.7, 0.9)
    expect(Math.max(...after)).toBeLessThanOrEqual(dug(0.7, 0.9) + 0.001)
    expect(dug(0.7, 0.9) - Math.max(...after)).toBeLessThan(0.025)
    expect(Math.max(...after)).toBeLessThan(Math.max(...before) - 0.1)
    expect(p.root.position.y).toBeLessThan(0.1)
  })

  it('laying the ground again and again leaks nothing: the heap and the body count are the same after every round', () => {
    const p = plateOnRolling(0.1)
    run(p, 240)
    const round = (k: number): void => {
      p.ground.at = (x, z) => 0.01 * Math.sin(2 * x) * Math.sin(2 * z) + 0.02 * (k % 2) * Math.sin(3 * x)
      p.system.wakeRegion(0.3, 0.3, 4)
      run(p, 12)
    }
    // two grounds in turn: the heap holds what the current shapes are (a compound's size follows its children), so it is compared at the same ground; the contacts
    // of the plate move it by a hundred bytes either way, and one leaked solid is 39 KB a round, 1.5 MB over the 40
    for (let k = 0; k < 4; k++) round(k)
    const bytes = p.world.memoryInUse()
    const bodies = p.world.bodyCount
    for (let k = 4; k < 44; k++) round(k)
    expect(p.world.bodyCount).toBe(bodies)
    expect(Math.abs(p.world.memoryInUse() - bytes)).toBeLessThan(4096)
  })

  it('a 45 m wire lying across the ground lays the tiles under it, not the circle around it (a 480 ms update in the room), and a thin piece still has ground under every point of it (T3.8b)', () => {
    const system = new PieceSystem(THREE, { physics: physicsOption(), groundAt: () => 0, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene() })
    const root = new THREE.Object3D()
    root.position.set(0, 0.02, 0)
    // 22.7 m each way along a diagonal of the ground, 4 cm thick, lying
    root.rotation.set(0, Math.PI / 4, 0)
    const piece = system.create('wire', root, [22.675, 0.02, 0.02], new THREE.Vector3(), 12)
    system.update(1 / 60)
    const tiles = (system as unknown as { engine: { tiles: Map<number, unknown> } }).engine.tiles
    // the circle around it is 24 x 24 = 576+ tiles; the diagonal strip is about 2 x 23
    expect(tiles.size).toBeLessThan(80)
    expect(tiles.size).toBeGreaterThan(20)
    // every point along the wire is over a laid tile (the key is column and row of a 2 m tile)
    const laid = (x: number, z: number): boolean => tiles.has((Math.floor(x / 2) + 32768) * 65536 + (Math.floor(z / 2) + 32768))
    const along = Math.SQRT1_2
    for (let d = -22.6; d <= 22.6; d += 0.5) expect(laid(d * along, -d * along) || laid(d * along, d * along)).toBe(true)
    expect(piece.mass).toBe(12)
  })
})
