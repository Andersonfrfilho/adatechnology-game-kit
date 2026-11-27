import * as THREE_NS from 'three'
import { describe, expect, it, vi } from 'vitest'

import type { ModuleHost, TestableItem } from '@adatechnology/game-contracts'
import { KIT_WORLD, createPhysicsLoop, isPhysicsServices } from '@adatechnology/game-physics'
import type { BodyId, PhysicsServices } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import type { JoltWorld } from '@adatechnology/game-physics-jolt'

import { buildFromSpec } from '../src/build-from-spec'
import type { TestRoom } from '../src'
import { demoItems } from './fixtures/demo-items'
import { makeRoom } from './helpers'

/**
 * Spec 008, TS.8: the room as production makes it (Jolt), a blow of the engine on a fixed drawn part is a hit of the destruction world with its sound, and a blast finds the
 * pieces it reaches by the engine's blast query.
 */

const SLAB_TOP = 0.4
const slab: TestableItem = {
  id: 'concrete_slab',
  name: 'Concrete slab',
  build: (T: unknown) => buildFromSpec(T as typeof THREE_NS, { name: 'Concrete slab', parts: [{ id: 'top', material: 'concrete', shape: { kind: 'box', size: [8, SLAB_TOP, 8] }, position: [0, SLAB_TOP / 2, 0] }] }),
}

type Sound = { readonly key: string; readonly volume: number }
type Run = { readonly room: TestRoom; readonly loop: ReturnType<typeof createPhysicsLoop>; readonly world: JoltWorld; readonly damage: string[]; readonly sounds: Sound[]; readonly services: PhysicsServices; dispose(): void }

const sceneOf = async (): Promise<Run> => {
  const world = (await createJoltEngine()).createWorld({ ...KIT_WORLD }) as JoltWorld
  const loop = createPhysicsLoop(world)
  const sounds: Sound[] = []
  const damage: string[] = []
  const room = makeRoom({
    physics: loop,
    catalog: demoItems('en', []),
    onSound: (key, _point, volume) => sounds.push({ key, volume }),
    onEvent: (event) => {
      if (event.type === 'damage') damage.push(`${event.object}/${event.part}/${event.source}`)
    },
  })
  let lent: ModuleHost | undefined
  room.loadModule({ id: 'probe', name: 'Probe', group: 'Probe', items: () => [slab], area: () => ({ placements: [{ item: 'concrete_slab', position: [0, 0, 0], fixed: true }] }), attach: (host) => { lent = host; return () => undefined } })
  room.openArea('probe')
  for (let i = 0; i < 60; i++) room.update(1 / 60)
  if (!isPhysicsServices(lent?.physics)) throw new Error('the room has no physics services')
  return { room, loop, world, damage, sounds, services: lent.physics, dispose: () => (room.dispose(), world.dispose()) }
}

const dropBox = (run: Run, height: number, at: [number, number] = [0, 0], user = 900_000): BodyId =>
  run.world.createBody({ shape: { kind: 'box', half: [0.25, 0.25, 0.25] }, motion: 'dynamic', mass: 20, position: [at[0], SLAB_TOP + 0.25 + height, at[1]], layer: 'debris', user })

const run = (scene: Run, seconds: number): void => {
  for (let i = 0; i < seconds * 60; i++) scene.room.update(1 / 60)
}

describe('contact hits on the room as production makes it (spec 008, TS.8)', () => {
  it('a box that falls 2 m onto a fixed part gives one hit with the material of the part and its sound, and nothing more while it rests', async () => {
    const scene = await sceneOf()
    scene.damage.length = 0
    scene.sounds.length = 0
    dropBox(scene, 2)
    run(scene, 4)
    expect(scene.damage).toHaveLength(1)
    expect(scene.damage[0]).toMatch(/\/top\/engine$/)
    const impact = scene.sounds.filter((sound) => sound.key.startsWith('impact_'))
    expect(impact.length).toBeGreaterThan(0)
    expect(impact.every((sound) => /masonry/.test(sound.key))).toBe(true)
    scene.dispose()
  }, 60000)

  it('a box that lands slowly does not hit', async () => {
    const scene = await sceneOf()
    scene.damage.length = 0
    dropBox(scene, 0.05)
    run(scene, 3)
    expect(scene.damage).toHaveLength(0)
    scene.dispose()
  }, 60000)

  it('a heap of 42 boxes let go at once makes fewer hits than boxes, held to the quota of a frame, and none once it rests', async () => {
    const scene = await sceneOf()
    scene.damage.length = 0
    let user = 900_000
    for (let row = 0; row < 6; row++) for (let column = 0; column < 7; column++) dropBox(scene, 2.5, [column * 0.9 - 2.7, row * 0.9 - 2.2], user++)
    let most = 0
    for (let frame = 0; frame < 240; frame++) {
      const before = scene.damage.length
      scene.room.update(1 / 60)
      most = Math.max(most, scene.damage.length - before)
    }
    const settling = scene.damage.length
    // the strongest blow on each fixed body of a frame, not one for every box that lands: 42 boxes make fewer hits than boxes, and never more than the quota in a frame
    expect(settling).toBeGreaterThan(0)
    expect(settling).toBeLessThan(42)
    expect(most).toBeLessThanOrEqual(32)
    run(scene, 3)
    expect(scene.damage.length).toBe(settling)
    scene.dispose()
  }, 60000)

  it('a column of boxes that settles on the part does not hit once it rests', async () => {
    const scene = await sceneOf()
    scene.damage.length = 0
    let user = 900_000
    for (let layer = 0; layer < 8; layer++) dropBox(scene, layer * 0.5 + 0.02, [0, 0], user++)
    run(scene, 4)
    const settling = scene.damage.length
    expect(settling).toBeLessThanOrEqual(8)
    run(scene, 3)
    expect(scene.damage.length).toBe(settling)
    scene.dispose()
  }, 60000)

  it('two runs of the same scene give the same hits and sounds', async () => {
    const take = async (): Promise<string> => {
      const scene = await sceneOf()
      scene.damage.length = 0
      scene.sounds.length = 0
      let user = 900_000
      for (let i = 0; i < 5; i++) dropBox(scene, 1 + i * 0.7, [i * 0.8 - 1.6, 0.3 * i], user++)
      run(scene, 4)
      const result = JSON.stringify([scene.damage, scene.sounds])
      scene.dispose()
      return result
    }
    const first = await take()
    expect(first.length).toBeGreaterThan(20)
    expect(await take()).toBe(first)
  }, 120000)
})

describe('a blast finds its pieces by the engine blast query (spec 008, TS.8)', () => {
  const speedOf = (room: TestRoom, objectId: string): number => {
    const piece = room.renderer.pieces().find((candidate) => candidate.objectId === objectId)
    return piece ? Math.hypot(...piece.velocity) : 0
  }
  const crateAt = (room: TestRoom, at: [number, number, number]): string => {
    const objectId = room.spawn('wooden_crate', at).objectId
    room.renderer.makePiece(objectId)
    return objectId
  }

  it('reaches and pushes the pieces in the radius and only them', async () => {
    const scene = await sceneOf()
    const crates = [1.5, 3, 40].map((distance) => ({ distance, objectId: crateAt(scene.room, [distance, 0, 6]) }))
    run(scene, 3)
    const query = vi.spyOn(scene.services.blast, 'run')
    scene.room.blastAt('m67', [0, 0.3, 6])
    run(scene, 0.05)
    expect(query).toHaveBeenCalledTimes(1)
    const pushed = crates.map(({ distance, objectId }) => [distance, speedOf(scene.room, objectId) > 0.3] as const)
    expect(pushed).toEqual([[1.5, true], [3, true], [40, false]])
    scene.dispose()
  }, 60000)

  it('on the own solver there are no services and the blast walks the pieces as before', async () => {
    const own = makeRoom({ physics: 'own', catalog: demoItems('en', []) })
    const crates = [1.5, 3, 40].map((distance) => ({ distance, objectId: crateAt(own, [distance, 0, 6]) }))
    for (let i = 0; i < 180; i++) own.update(1 / 60)
    own.blastAt('m67', [0, 0.3, 6])
    for (let i = 0; i < 3; i++) own.update(1 / 60)
    const pushed = crates.map(({ distance, objectId }) => [distance, speedOf(own, objectId) > 0.3] as const)
    expect(pushed).toEqual([[1.5, true], [3, true], [40, false]])
    own.dispose()
  }, 60000)
})
