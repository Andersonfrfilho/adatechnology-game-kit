// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'

import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import type { WorkerCoordinator } from '@adatechnology/game-contracts'

import type { KitWorld } from '../src/world'
import { makeWorld } from './world-helpers'

const worlds: KitWorld[] = []
const track = async (promise: Promise<KitWorld>): Promise<KitWorld> => {
  const world = await promise
  worlds.push(world)
  return world
}
afterEach(() => {
  for (const world of worlds.splice(0)) world.dispose()
})

/** A coordinator that says it has real workers, which the ground tiles need before they go to workers. */
const coordinatorWith = (workers: number): WorkerCoordinator => ({ stats: () => ({ workers }), dispose: () => undefined }) as unknown as WorkerCoordinator

describe('what the host turns on by default (design-host 3, "Padrão")', () => {
  it('turns blast pacing and the D4 debris policy on, and the ground in workers off without workers', async () => {
    const world = await track(makeWorld())
    expect(world.info.blastPacing).toBe(true)
    expect(world.blastPacing).toBeDefined()
    expect(world.info.blastDebris).toBe(true)
    expect(world.info.groundWorker).toBe(false)
    expect(world.info.groundWorkerOff).toBe('no workers')
    expect(world.info.physics.kind).toBe('own')
  })

  it('turns the ground in workers on only with a coordinator that has real workers', async () => {
    expect((await track(makeWorld({ workers: coordinatorWith(2) }))).info.groundWorker).toBe(true)
    const none = await track(makeWorld({ workers: coordinatorWith(0) }))
    expect(none.info.groundWorker).toBe(false)
    expect(none.info.groundWorkerOff).toBe('the coordinator has no real workers')
  })

  it('turns each default off by an explicit false', async () => {
    const world = await track(makeWorld({ workers: coordinatorWith(2), blastPacing: false, debris: { blast: false, groundWorker: false } }))
    expect(world.info.blastPacing).toBe(false)
    expect(world.blastPacing).toBeUndefined()
    expect(world.info.blastDebris).toBe(false)
    expect(world.info.groundWorker).toBe(false)
    expect(world.info.groundWorkerOff).toBe('turned off')
    expect(world.frame.systems().some((system) => system.id.startsWith('room.blast-pacing'))).toBe(false)
  })

  it('takes the blast pacing options as they come', async () => {
    const world = await track(makeWorld({ blastPacing: { raysPerFrame: 32 } }))
    expect(world.info.blastPacing).toBe(true)
  })

  it('defaults the physics to Jolt', async () => {
    const world = await track(makeWorld({ physics: undefined }))
    expect(world.info.physics.kind).toBe('jolt')
    expect(world.physics.loop?.world.fixedStep).toBe(KIT_WORLD.fixedStep)
    expect(world.frame.tick).toBeCloseTo(1 / 60, 12)
  })

  it('releases only what it made: a physics loop of the game is left standing', async () => {
    const engine = await createJoltEngine()
    const joltWorld = engine.createWorld(KIT_WORLD)
    const loop = createPhysicsLoop(joltWorld)
    const world = await makeWorld({ physics: loop })
    expect(world.info.physics.kind).toBe('loop')
    world.dispose()
    // the world the game made still answers: the host did not dispose it
    expect(() => joltWorld.stepFixed(KIT_WORLD.fixedStep ?? 1 / 120)).not.toThrow()
    joltWorld.dispose()
  })

  it('does not dispose a coordinator the game handed in', async () => {
    let disposed = 0
    const coordinator = { stats: () => ({ workers: 0 }), dispose: () => void disposed++ } as unknown as WorkerCoordinator
    const world = await makeWorld({ workers: coordinator })
    world.dispose()
    expect(disposed).toBe(0)
  })
})
