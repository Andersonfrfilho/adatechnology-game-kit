import { describe, expect, it } from 'vitest'

import { corpseBodyKit, createRig, GUIDE } from '@adatechnology/game-characters'
import { createCorpseBodies, createPhysicsLoop, KIT_WORLD } from '@adatechnology/game-physics'
import type { SettledCorpse } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'

import { createCrowd, createNavGrid, relocateCorpse } from '../../src'
import type { Crowd } from '../../src'
import { packWithBalance, physicsOptions } from './scenes'

const STEP = 1 / 60
const kit = corpseBodyKit({ rig: createRig({ body: GUIDE, height: 1.8, build: 1 }), body: GUIDE, build: 1 })

const newCrowd = (): Crowd =>
  createCrowd({ pack: packWithBalance(), seed: 3, grid: createNavGrid({ size: 128 }), capacity: 50, flow: { cellsPerStep: 20000, clock: () => 0 }, physics: physicsOptions({ personality: false }) })

/** The height (mm) of the mound in the cell of (x, z) and its eight neighbours: the biggest. */
const moundAround = (crowd: Crowd, x: number, z: number): number => {
  let tallest = 0
  for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) tallest = Math.max(tallest, crowd.mound[crowd.grid.cellOf(x + dx * crowd.grid.cell, z + dz * crowd.grid.cell)] ?? 0)
  return tallest
}

describe('design/pilha-e-lod.md §4, option A: the horde climbs the mound where the body lies', () => {
  it('13. a corpse the physics pushed 3 m is told to the crowd: the mound is in the cell the engine puts it, and not in the old one', { timeout: 60000 }, async () => {
    const world = (await createJoltEngine()).createWorld(KIT_WORLD)
    world.createBody({ shape: { kind: 'box', half: [100, 0.5, 100] }, motion: 'static', position: [0, -0.5, 0], user: -1 })
    const loop = createPhysicsLoop(world)
    const crowd = newCrowd()
    const told: SettledCorpse[] = []
    const bodies = createCorpseBodies(loop, {
      lod: { ragdollsMax: 0 },
      onSettled: (corpse) => {
        told.push(corpse)
        relocateCorpse(crowd, corpse)
      },
    })
    crowd.corpses.subscribe({
      added: (entry) => bodies.add({ id: entry.id, kit, position: [entry.data.x, 0.02, entry.data.z], yaw: entry.data.yaw }),
      removed: (entry) => bodies.follower.removed(entry),
    })
    const steps = (count: number): void => {
      for (let step = 0; step < count; step++) {
        loop.step(STEP)
        crowd.update(STEP, { bandCentre: [0, 0], flowTarget: [0, 0] })
      }
    }
    const i = crowd.spawn(4, -6, 0)
    crowd.store.height[i] = 1.8
    crowd.store.build[i] = 1
    crowd.kill(i)
    const id = crowd.corpses.entries[0]?.id as number
    expect(bodies.rungOf(id)).toBe('r1')
    steps(60 * 5)
    const born = { x: crowd.corpses.entries[0]?.data.x as number, z: crowd.corpses.entries[0]?.data.z as number }
    // nothing pushed it: it lies where it fell and the ledger was not touched
    expect(told).toHaveLength(0)
    expect(moundAround(crowd, born.x, born.z)).toBeGreaterThan(0)
    for (const body of bodies.partsOf(id)) world.setVelocity(body, [8, 0, 0], [0, 0, 0])
    steps(60 * 6)
    const lies = new Float64Array(7)
    bodies.readTorso(id, lies, 0)
    expect(lies[0] as number).toBeGreaterThan(born.x + 2.5)
    expect(told).toHaveLength(1)
    // the mound is where the engine has the body (within a cell), and it left the old place
    const entry = crowd.corpses.entries[0]?.data as { x: number; z: number }
    expect(Math.hypot(entry.x - (lies[0] as number), entry.z - (lies[2] as number))).toBeLessThan(0.05)
    expect(moundAround(crowd, lies[0] as number, lies[2] as number)).toBeGreaterThan(0)
    expect(moundAround(crowd, born.x, born.z)).toBe(0)
    world.dispose()
  })
})
