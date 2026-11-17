import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import type { BodyDesc, BodyId, PhysicsLoop } from '@adatechnology/game-physics'
import type { JoltWorld } from '@adatechnology/game-physics-jolt'
import { describe, expect, it } from 'vitest'

import { THREE, houseOf, planOf } from './helpers/houses'
import { IS_JOLT, physicsLoop, tick } from './setup-physics'

const FRAME = 1 / 60
/** The room's C4 by the house (`tools/gpu/room-explosion.mjs`: 2.5 m off its middle, 0.6 m up), as the blast of `blast-presentation.test.ts`. */
const BLAST_ENERGY = 4e6
const BLAST_RADIUS = 6

/** What the frames that make pieces did: the part boxes taken made ahead and those built when their bodies were made (batches of pieces only: no fixed thing, no ground). */
interface Assembly {
  taken: number
  built: number
  pieces: number
}

/**
 * A house of the template, moved and turned as the room places it, on the Jolt loop; its parts fitted and their shapes made ahead (the queue flushed: the room's load has the
 * seconds), then the blast and 2 s of frames. Only the batches of new pieces (`createBodies` of dynamic bodies) are counted.
 */
const blowHouse = (template: string, seed: number): Assembly => {
  const world = createDestruction({ seed: 5 })
  const scene = new THREE.Scene()
  const loop = physicsLoop() as PhysicsLoop
  const renderer = createDestructionRenderer(THREE, { physics: loop, scene, world })
  const { house } = houseOf(planOf(template, seed), { destruction: world, destructionRenderer: renderer })
  house.group.position.set(23.5, 0, -11.2)
  house.group.rotation.y = 0.6
  house.group.updateMatrixWorld(true)
  scene.add(house.group)
  house.destruction.activate()
  renderer.deferredQueue().flush()
  const engine = loop.world as unknown as JoltWorld
  const ready = engine.ready
  const counted: Assembly = { taken: 0, built: 0, pieces: 0 }
  const batch = engine.createBodies.bind(engine)
  engine.createBodies = (descs: readonly BodyDesc[]): BodyId[] => {
    const isPieces = descs.length > 0 && descs.every((desc) => desc.motion !== 'static')
    const before = { taken: ready.taken, built: ready.builtAtAssembly }
    const ids = batch(descs)
    if (isPieces) {
      counted.taken += ready.taken - before.taken
      counted.built += ready.builtAtAssembly - before.built
      counted.pieces += descs.length
    }
    return ids
  }
  const at = house.group.localToWorld(new THREE.Vector3(-2.5, 0.6, 0))
  world.explode([at.x, at.y, at.z], BLAST_ENERGY, BLAST_RADIUS)
  for (let frame = 0; frame < 120; frame++) {
    world.update(FRAME)
    tick(loop, renderer, FRAME)
  }
  renderer.dispose()
  return counted
}

describe.skipIf(!IS_JOLT)('the part boxes of a house made ahead of the blast (spec 008 B6): how many the pieces take', () => {
  it.each([
    ['single_storey_a', 1],
    ['sobrado', 2],
  ])('%s seed %i, moved and turned: the pieces take the shapes made ahead and build almost none', (template, seed) => {
    const { taken, built, pieces } = blowHouse(template, seed)
    const rate = taken / Math.max(1, taken + built)
    console.log(JSON.stringify({ template, seed, pieces, taken, built, rate: Math.round(rate * 1000) / 1000 }))
    expect(pieces).toBeGreaterThan(0)
    expect(rate).toBeGreaterThan(0.9)
  }, 600000)
})
