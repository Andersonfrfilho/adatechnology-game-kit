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
  joints: [],
})

const streetOfWalls = () => {
  const world = createDestruction()
  const scene = new THREE.Scene()
  const spec = wallSpec()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world, eventBudgetMs: Infinity, rayBroadPhase: true })
  for (let k = 0; k < WALLS; k++) {
    const x = (k % 25) * 8 - 100
    const z = Math.floor(k / 25) * 8 - 80
    const id = `wall_${k}`
    world.add(spec, { id, position: [x, 0, z] })
    const root = new THREE.Group()
    const meshes: Record<string, THREE.Mesh> = {}
    for (const part of spec.parts) {
      const size = part.shape.kind === 'box' ? part.shape.size : [1, 1, 1]
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]))
      mesh.position.set(...part.position)
      root.add(mesh)
      meshes[part.id] = mesh
    }
    root.position.set(x, 0, z)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind(id, root, { parts: meshes })
  }
  for (let t = 0; t < 0.5; t += 1 / 60) renderer.update(1 / 60)
  return { world, renderer }
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

const same = (a: RayHit | null, b: RayHit | null): boolean => (a === null ? b === null : b !== null && a.object === b.object && a.part === b.part && Math.abs(a.distance - b.distance) < 1e-9)

engineOnly('the engine as the broad phase of the destruction world rays', () => {
  it('1 000 rays hit what they hit without it: same object, part and distance; and most objects are never read', { timeout: 60000 }, () => {
    const { world, renderer } = streetOfWalls()
    let asked = 0
    let skipped = 0
    const list = shots()
    for (const s of list) world.raycast(s.from, s.dir, 80)
    const timeEngine = performance.now()
    const withEngine = list.map((s) => world.raycast(s.from, s.dir, 80))
    const engineMs = performance.now() - timeEngine
    // the same rays with the world's own bounding spheres
    world.setRayBroadPhase(null)
    for (const s of list) world.raycast(s.from, s.dir, 80)
    const timeOwn = performance.now()
    const without = list.map((s) => world.raycast(s.from, s.dir, 80))
    const ownMs = performance.now() - timeOwn
    expect(withEngine.every((hit, i) => same(hit, without[i]!))).toBe(true)
    expect(withEngine.filter((hit) => hit !== null).length).toBeGreaterThan(20)
    // count what the broad phase leaves out: the same rays again through a counting wrapper of the one the renderer made
    const pieces = (renderer as unknown as { pieceSys: { rayBroadPhase(): { begin(o: Vec3, d: Vec3, m: number): boolean; mayMeet(id: string): boolean } } }).pieceSys
    const broad = pieces.rayBroadPhase()
    for (const s of list) {
      if (!broad.begin(s.from, s.dir, 80)) continue
      for (let k = 0; k < WALLS; k++) {
        asked++
        if (!broad.mayMeet(`wall_${k}`)) skipped++
      }
    }
    console.log(JSON.stringify({ name: 'T7.2-ray-broad-phase', walls: WALLS, rays: RAYS, engineMsFor1000: Math.round(engineMs * 10) / 10, ownMsFor1000: Math.round(ownMs * 10) / 10, objectsAsked: asked, objectsSkipped: skipped }))
    expect(skipped / asked).toBeGreaterThan(0.8)
    renderer.dispose()
  })
})
