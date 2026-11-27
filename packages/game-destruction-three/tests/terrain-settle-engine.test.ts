import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createTerrain } from '@adatechnology/game-terrain'

import { buildGroundTile } from '../src/engine-ground'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

const BOUNDS = [-20, -20, 20, 20] as const
const GRENADE = 3_200_000
const TILE = 2
const TILE_KEY = 65536
const TILE_KEY_ORIGIN = 32768
/** How far (m) the engine's tile may be from the drawn ground. */
const TILE_TOLERANCE = 1e-3
/** How far (m) a piece resting on a one-cell spike of rubble may sink into it: the engine's 2.5 cm tile cells cut the apex of a 10 cm spike by a few mm. */
const SINK_TOLERANCE = 8e-3
const HALF = 0.1
const FRAME = 1 / 60

// no sliding: every rise after the blow is rubble that settled, the case that told nothing
const makeTerrain = () => createTerrain({ bounds: BOUNDS, layout: { surface: 'dirt' }, seed: 7, budget: { maxSlideCellsPerFrame: 0 } })

/** A sleeping piece looks again at the ground under its centre once it moved this much (`GROUND_DROP`): a rise below it is only seen if the terrain tells. */
const UNSEEN_RISE = 0.018
/** Where the rubble of a blow raises the ground most while staying under what a sleeper sees by itself, found on a terrain of its own (same seed, same blow: the same rubble). */
const highestRise = (): { x: number; z: number } => {
  const terrain = makeTerrain()
  terrain.strike('explosive', { x: 0, z: 0, energy: GRENADE })
  for (let t = 0; t < 8; t += FRAME) terrain.update(FRAME)
  let best = { x: 0, z: 0, rise: 0 }
  // one probe on each vertex of the 0.1 m grid, away from the crater
  for (let column = 0; column <= 400; column++) {
    for (let row = 0; row <= 400; row++) {
      const x = -20 + column * 0.1, z = -20 + row * 0.1
      const rise = terrain.heightAt(x, z)
      if (Math.hypot(x, z) > 3 && rise < UNSEEN_RISE && rise > best.rise) best = { x, z, rise }
    }
  }
  if (best.rise <= 0) throw new Error('no rubble settled')
  return best
}

type EngineTiles = { tiles: Map<number, { samples: Float64Array | null; level: number | null }> }

/** How many of the engine's tiles are further than the tolerance from the ground that is drawn, and the worst gap (m). */
const staleTiles = (renderer: unknown, groundAt: (x: number, z: number) => number): { stale: number; worst: number } => {
  const engine = (renderer as { pieceSys: { engine: EngineTiles | null } }).pieceSys.engine
  let stale = 0
  let worst = 0
  for (const [key, tile] of engine?.tiles ?? []) {
    const ix = Math.floor(key / TILE_KEY) - TILE_KEY_ORIGIN
    const iz = (key % TILE_KEY) - TILE_KEY_ORIGIN
    const fresh = buildGroundTile(groundAt, ix * TILE, iz * TILE, TILE).samples!
    let gap = 0
    // a tile proved level holds no samples: every sample the ground has now is held against its level
    for (let i = 0; i < fresh.length; i++) gap = Math.max(gap, Math.abs(fresh[i]! - (tile.samples ? tile.samples[i]! : tile.level!)))
    worst = Math.max(worst, gap)
    if (gap > TILE_TOLERANCE) stale++
  }
  return { stale, worst }
}

/** How far (m) the deepest point of the box's bottom face (a 5 x 5 grid of points) is under the ground at its own x, z. */
const deepestPoint = (root: THREE.Object3D, groundAt: (x: number, z: number) => number): number => {
  root.updateMatrixWorld(true)
  let deepest = -Infinity
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      const at = new THREE.Vector3(i * 0.1, -HALF, j * 0.1).applyMatrix4(root.matrixWorld)
      deepest = Math.max(deepest, groundAt(at.x, at.z) - at.y)
    }
  }
  return deepest
}

describe('ground that settles tells the engine', () => {
  it('after rubble settles the engine tile matches the drawn ground, and a piece resting there is woken and does not end inside it', () => {
    const spot = highestRise()
    const terrain = makeTerrain()
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const groundAt = (x: number, z: number): number => terrain.heightAt(x, z)
    const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), groundAt })
    terrain.onDeform((region) => { renderer.wakeRegion(region.x, region.z, region.radius) })
    world.addObject('slab', [partState('body', 'concrete', { mass: 40 })])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2 * HALF, 0.4))
    const root = new THREE.Group()
    root.add(mesh)
    root.position.set(spot.x, groundAt(spot.x, spot.z) + HALF, spot.z)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind('slab', root, { parts: { body: mesh } })
    const piece = renderer.makePiece('slab')
    for (let t = 0; t < 3; t += FRAME) renderer.update(FRAME)
    expect(piece.sleeping).toBe(true)

    terrain.strike('explosive', { x: 0, z: 0, energy: GRENADE })
    let woken = false
    for (let t = 0; t < 8; t += FRAME) {
      terrain.update(FRAME)
      renderer.update(FRAME)
      woken ||= !piece.sleeping
    }
    for (let t = 0; t < 4; t += FRAME) renderer.update(FRAME)

    expect(woken).toBe(true)
    const { stale, worst } = staleTiles(renderer, groundAt)
    expect(worst).toBeLessThan(TILE_TOLERANCE)
    expect(stale).toBe(0)
    expect(deepestPoint(root, groundAt)).toBeLessThan(SINK_TOLERANCE)
  })
})
