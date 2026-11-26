import { performance } from 'node:perf_hooks'

import { corpseBodyKit, createRig, GUIDE } from '@adatechnology/game-characters'
import { createCorpseBodies, createPhysicsLoop, KIT_WORLD } from '@adatechnology/game-physics'
import type { BodyId, CorpseBodies, CorpseBodiesOptions, CorpseBodyKit, PhysicsLoop, Vec3 } from '@adatechnology/game-physics'

import { createJoltEngine } from '../src/index'
import type { JoltWorld } from '../src/index'
import { ground } from './scenes'

export const kit: CorpseBodyKit = corpseBodyKit({ rig: createRig({ body: GUIDE, height: 1.8, build: 1 }), body: GUIDE, build: 1 })

/** The reference machine's C7 for dead bodies (spec 008 §6.2): median and p99 of one frame (1/60 s, two fixed steps at 120 Hz). */
export const C7_BODIES = { median: 3.0, p99: 4.0 } as const
/** The 100 bodies in a pile: 2.5 ms median, 4.0 p99 (§6.2). */
export const C7_PILE = { median: 2.5, p99: 4.0 } as const
/** The pile's wake frame (condition 10). */
export const PEAK_MS = 10

export interface Scene {
  readonly world: JoltWorld
  readonly loop: PhysicsLoop
  readonly corpses: CorpseBodies
}

export const sceneOf = async (options: CorpseBodiesOptions = {}, wall = false): Promise<Scene> => {
  const world = (await createJoltEngine()).createWorld(KIT_WORLD) as JoltWorld
  ground(world, 100)
  if (wall) world.createBody({ shape: { kind: 'box', half: [6, 1.5, 0.2] }, motion: 'static', position: [0, 1.5, -0.2], user: -1 })
  const loop = createPhysicsLoop(world)
  return { world, loop, corpses: createCorpseBodies(loop, options) }
}

/** One frame of `1/60` s; its cost in milliseconds. */
export const frame = (loop: PhysicsLoop, dt = 1 / 60): number => {
  const started = performance.now()
  loop.step(dt)
  return performance.now() - started
}

export const seconds = (loop: PhysicsLoop, time: number): void => {
  for (let i = 0; i < Math.round(time * 60); i++) loop.step(1 / 60)
}

/** Every body of every corpse in `ids` is asleep (a corpse in R2f or R3 has none to wake). */
export const allAsleep = (scene: Scene, ids: readonly number[]): boolean => ids.every((id) => scene.corpses.partsOf(id).every((body) => scene.world.isSleeping(body)))

export const torsoOf = (scene: Scene, id: number): Vec3 => {
  const out = new Float64Array(7)
  scene.corpses.readTorso(id, out, 0)
  return [out[0] as number, out[1] as number, out[2] as number]
}

/** The 100 of the pile test: dropped in a heap against a wall, as `crowd.test.ts` does. */
export const heapAt = (i: number): Vec3 => [((i % 10) - 5) * 0.8, 0.3 + Math.floor(i / 10) * 0.45, 0.6 + (i % 3) * 0.3]

export const allParts = (scene: Scene, ids: readonly number[]): BodyId[] => ids.flatMap((id) => [...scene.corpses.partsOf(id)])

/** A heap of `count` dead bodies against the wall, run until everything sleeps and the base has frozen; the ids. */
export const pileOf = (scene: Scene, count: number): number[] => {
  const ids = Array.from({ length: count }, (_, i) => i + 1)
  for (const id of ids) scene.corpses.add({ id, kit, position: heapAt(id - 1), yaw: id * 0.7 })
  seconds(scene.loop, 16)
  return ids
}

/** `count` sleeping chains on a 3 m grid, nothing touching anything: every one alone, asleep. */
export const scatter = (scene: Scene, count: number, first = 1): number[] => {
  const ids = Array.from({ length: count }, (_, i) => first + i)
  for (const id of ids) scene.corpses.add({ id, kit, position: [((id - first) % 10) * 3 - 13, 0.05, Math.floor((id - first) / 10) * 3 - 13], yaw: id })
  return ids
}
