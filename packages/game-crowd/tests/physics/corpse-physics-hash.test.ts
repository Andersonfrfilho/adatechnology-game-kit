import { describe, expect, it } from 'vitest'

import { corpseBodyKit, createRig, GUIDE } from '@adatechnology/game-characters'
import { createCorpseBodies, createPhysicsLoop, KIT_WORLD } from '@adatechnology/game-physics'
import type { CorpseBodiesOptions } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'

import { createCrowd, createNavGrid, relocateCorpse } from '../../src'
import type { Crowd } from '../../src'
import { packWithBalance, physicsOptions } from './scenes'
import { hashCrowdState } from './state-hash'

const STEP = 1 / 60
const SECONDS = 8
const kit = corpseBodyKit({ rig: createRig({ body: GUIDE, height: 1.8, build: 1 }), body: GUIDE, build: 1 })
const SPOTS = [[-6, 3], [-3, 5], [0, 4], [3, 6], [6, 3], [9, 5]] as const

const newCrowd = (): Crowd =>
  createCrowd({ pack: packWithBalance(), seed: 3, grid: createNavGrid({ size: 128 }), capacity: 50, flow: { cellsPerStep: 20000, clock: () => 0 }, physics: physicsOptions({ personality: false }) })

/** The same dead bodies of the same crowd for `SECONDS`, with the physics world stepping or not; nothing pushes any of them. */
const run = async (withPhysics: boolean, lod: CorpseBodiesOptions['lod']): Promise<{ readonly hash: string; readonly registry: string; readonly told: number; readonly rigidBodies: number }> => {
  const crowd = newCrowd()
  let told = 0
  const world = (await createJoltEngine()).createWorld(KIT_WORLD)
  world.createBody({ shape: { kind: 'box', half: [100, 0.5, 100] }, motion: 'static', position: [0, -0.5, 0], user: -1 })
  const loop = createPhysicsLoop(world)
  const bodies = createCorpseBodies(loop, { lod, onSettled: (corpse) => { told++; relocateCorpse(crowd, corpse) } })
  crowd.corpses.subscribe({
    added: (entry) => bodies.add({ id: entry.id, kit, position: [entry.data.x, 0.02, entry.data.z], yaw: entry.data.yaw }),
    removed: (entry) => bodies.follower.removed(entry),
  })
  for (const [x, z] of SPOTS) {
    const i = crowd.spawn(x, z, 0)
    crowd.store.height[i] = 1.8
    crowd.store.build[i] = 1
    crowd.kill(i)
  }
  for (let step = 0; step < SECONDS * 60; step++) {
    if (withPhysics) loop.step(STEP)
    crowd.update(STEP, { bandCentre: [0, 0], flowTarget: [0, 0] })
  }
  const registry = JSON.stringify(crowd.corpses.entries.map((entry) => ({ id: entry.id, data: entry.data })))
  const rigidBodies = bodies.counts().rigidBodies
  world.dispose()
  return { hash: hashCrowdState(crowd), registry, told, rigidBodies }
}

describe('T7.1: the state of the crowd with the corpses in the physics world', () => {
  it.each([['the production quota (one ragdoll, the rest chains)', { ragdollsMax: 1 }], ['chains only', { ragdollsMax: 0 }]])('%s: the hash and the corpse registry equal the run without physics when nothing pushes a body', { timeout: 120000 }, async (_name, lod) => {
    const without = await run(false, lod)
    const withPhysics = await run(true, lod)
    expect(withPhysics.rigidBodies).toBeGreaterThan(0)
    expect(withPhysics.told).toBe(0)
    expect(JSON.parse(without.registry)).toHaveLength(SPOTS.length)
    expect(withPhysics.registry).toBe(without.registry)
    expect(withPhysics.hash).toBe(without.hash)
  })
})
