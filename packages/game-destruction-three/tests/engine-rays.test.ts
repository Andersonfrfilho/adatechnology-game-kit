import { performance } from 'node:perf_hooks'

import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructibleSpec, RayHit, Vec3 } from '@adatechnology/game-destruction'

import { createDestructionRenderer } from '../src/renderer'
import { IS_JOLT, physicsOption } from './setup-physics'

// the engine's broad phase is a mode of the engine only
const engineOnly = IS_JOLT ? describe : describe.skip

const WALLS = 500
const RAYS = 1000

/** A wall of three brick panels, 1 m each, 20 cm thick. */
const wallSpec = (): DestructibleSpec => ({
  name: 'wall',
  parts: [0, 1, 2].map((i) => ({ id: `panel_${i}`, material: 'brick', shape: { kind: 'box' as const, size: [1, 1, 0.2] as Vec3 }, position: [i - 1, 0.5, 0] as Vec3, anchored: true })),
  // joined, so the wall stays one object: a split piece the host never bound is one the engine does not hold, and is always tried
  joints: [
    { a: 'panel_0', b: 'panel_1', kind: 'rebar' },
    { a: 'panel_1', b: 'panel_2', kind: 'rebar' },
  ],
})

const addWall = (world: ReturnType<typeof createDestruction>, scene: THREE.Scene, renderer: ReturnType<typeof createDestructionRenderer>, id: string, x: number, z: number, hiddenPart?: string): void => {
  const spec = wallSpec()
  world.add(spec, { id, position: [x, 0, z] })
  const root = new THREE.Group()
  const meshes: Record<string, THREE.Mesh> = {}
  for (const part of spec.parts) {
    const size = part.shape.kind === 'box' ? part.shape.size : [1, 1, 1]
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]))
    mesh.position.set(...part.position)
    mesh.visible = part.id !== hiddenPart
    root.add(mesh)
    meshes[part.id] = mesh
  }
  root.position.set(x, 0, z)
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind(id, root, { parts: meshes })
}

const settle = (renderer: ReturnType<typeof createDestructionRenderer>): void => {
  for (let t = 0; t < 0.5; t += 1 / 60) renderer.update(1 / 60)
}

const streetOfWalls = () => {
  const world = createDestruction()
  const scene = new THREE.Scene()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world, eventBudgetMs: Infinity, rayBroadPhase: true })
  for (let k = 0; k < WALLS; k++) addWall(world, scene, renderer, `wall_${k}`, (k % 25) * 8 - 100, Math.floor(k / 25) * 8 - 80)
  settle(renderer)
  return { world, renderer, scene }
}

const shots = (): Array<{ from: Vec3; dir: Vec3 }> => {
  let seed = 7
  const random = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647
  return Array.from({ length: RAYS }, () => {
    const angle = random() * Math.PI * 2
    const dir: Vec3 = [Math.cos(angle), (random() - 0.5) * 0.2, Math.sin(angle)]
    return { from: [(random() - 0.5) * 220, 0.5 + random(), (random() - 0.5) * 180], dir }
  })
}

type RayBroadPhaseLike = { begin(o: Vec3, d: Vec3, m: number): boolean; mayMeet(id: string): boolean }

const same = (a: RayHit | null, b: RayHit | null): boolean => (a === null ? b === null : b !== null && a.object === b.object && a.part === b.part && Math.abs(a.distance - b.distance) < 1e-9)

engineOnly('the engine as the broad phase of the destruction world rays', () => {
  it('1 000 rays hit what they hit without it: same object, part and distance; and most objects are never read', { timeout: 60000 }, () => {
    const { world, renderer } = streetOfWalls()
    const pieces = (renderer as unknown as { pieceSys: { rayBroadPhase(): RayBroadPhaseLike } }).pieceSys
    let asked = 0
    let skipped = 0
    const list = shots()
    for (const s of list) world.raycast(s.from, s.dir, 80)
    const withEngine = list.map((s) => world.raycast(s.from, s.dir, 80))
    const engineRuns: number[] = []
    const ownRuns: number[] = []
    const scanRuns: number[] = []
    let without: Array<RayHit | null> = []
    for (let round = 0; round < 5; round++) {
      world.setRayBroadPhase(pieces.rayBroadPhase())
      let t = performance.now()
      for (const s of list) world.raycast(s.from, s.dir, 80)
      engineRuns.push(performance.now() - t)
      // the engine's answer asked of every object (what the world did before it visited only the candidates)
      const broad = pieces.rayBroadPhase()
      world.setRayBroadPhase({ begin: (o, d, m) => broad.begin(o, d, m), mayMeet: (id) => broad.mayMeet(id) })
      t = performance.now()
      const scanned = list.map((s) => world.raycast(s.from, s.dir, 80))
      scanRuns.push(performance.now() - t)
      expect(scanned.every((hit, i) => same(hit, withEngine[i]!))).toBe(true)
      // the same rays with the world's own bounding spheres
      world.setRayBroadPhase(null)
      t = performance.now()
      without = list.map((s) => world.raycast(s.from, s.dir, 80))
      ownRuns.push(performance.now() - t)
    }
    const median = (runs: number[]): number => [...runs].sort((a, b) => a - b)[Math.floor(runs.length / 2)]!
    const engineMs = median(engineRuns)
    const ownMs = median(ownRuns)
    expect(withEngine.every((hit, i) => same(hit, without[i]!))).toBe(true)
    expect(withEngine.filter((hit) => hit !== null).length).toBeGreaterThan(20)
    // count what the broad phase leaves out: the same rays again through a counting wrapper of the one the renderer made
    const broad = pieces.rayBroadPhase()
    for (const s of list) {
      if (!broad.begin(s.from, s.dir, 80)) continue
      for (let k = 0; k < WALLS; k++) {
        asked++
        if (!broad.mayMeet(`wall_${k}`)) skipped++
      }
    }
    console.log(JSON.stringify({ name: 'T7.2-ray-broad-phase', walls: WALLS, rays: RAYS, engineMsFor1000: Math.round(engineMs * 10) / 10, ownMsFor1000: Math.round(ownMs * 10) / 10, scanMsFor1000: Math.round(median(scanRuns) * 10) / 10, scanRuns: scanRuns.map((v) => Math.round(v * 10) / 10), engineRuns: engineRuns.map((v) => Math.round(v * 10) / 10), ownRuns: ownRuns.map((v) => Math.round(v * 10) / 10), objectsAsked: asked, objectsSkipped: skipped }))
    expect(skipped / asked).toBeGreaterThan(0.8)
    renderer.dispose()
  })
  it('an object whose list lacks a part the world can still hit (a hidden one) is not covered: the ray still finds that part', () => {
    const world = createDestruction()
    const scene = new THREE.Scene()
    const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world, eventBudgetMs: Infinity, rayBroadPhase: true })
    addWall(world, scene, renderer, 'wall_hidden', 0, 0, 'panel_2')
    for (let k = 1; k < 4; k++) addWall(world, scene, renderer, `wall_${k}`, k * 8, 0)
    settle(renderer)
    const pieces = (renderer as unknown as { pieceSys: { rayBroadPhase(): RayBroadPhaseLike } }).pieceSys
    // panel_2 is the one at x = 1
    const from: Vec3 = [1, 0.5, -3]
    const direction: Vec3 = [0, 0, 1]
    world.setRayBroadPhase(null)
    const without = world.raycast(from, direction, 10)
    expect(without?.part).toBe('panel_2')
    world.setRayBroadPhase(pieces.rayBroadPhase())
    expect(same(world.raycast(from, direction, 10), without)).toBe(true)
    renderer.dispose()
  })
  it('a tie between two objects goes to the one the world holds first, with or without the broad phase, also after one is added again', () => {
    const { world, renderer, scene } = streetOfWalls()
    // two walls on the very same place: every ray meets both at the same distance
    addWall(world, scene, renderer, 'tie_a', 300, 300)
    addWall(world, scene, renderer, 'tie_b', 300, 300)
    settle(renderer)
    const pieces = (renderer as unknown as { pieceSys: { rayBroadPhase(): RayBroadPhaseLike } }).pieceSys
    const rays: Array<{ from: Vec3; dir: Vec3 }> = [-0.9, -0.3, 0, 0.4, 0.8].map((x) => ({ from: [300 + x, 0.5, 296] as Vec3, dir: [0, 0, 1] as Vec3 }))
    const ask = (): Array<RayHit | null> => rays.map((r) => world.raycast(r.from, r.dir, 10))
    const check = (first: string): void => {
      world.setRayBroadPhase(pieces.rayBroadPhase())
      const withEngine = ask()
      world.setRayBroadPhase(null)
      const without = ask()
      world.setRayBroadPhase(pieces.rayBroadPhase())
      expect(withEngine.every((hit) => hit !== null)).toBe(true)
      expect(withEngine.every((hit, i) => same(hit, without[i]!))).toBe(true)
      expect(withEngine.every((hit) => hit!.object === first)).toBe(true)
    }
    check('tie_a')
    // an object removed and added again goes to the end of the world's order
    renderer.unbind('tie_a')
    world.remove('tie_a')
    addWall(world, scene, renderer, 'tie_a', 300, 300)
    settle(renderer)
    check('tie_b')
    // an object the engine holds no body of is always tried, in its own place in the order: here before the wall it ties with
    world.add(wallSpec(), { id: 'ghost', position: [400, 0, 300] })
    addWall(world, scene, renderer, 'tie_c', 400, 300)
    settle(renderer)
    rays.forEach((r) => (r.from[0] += 100))
    check('ghost')
    renderer.dispose()
  })
})
