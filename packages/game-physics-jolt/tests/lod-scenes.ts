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
/**
 * The 100 bodies in a pile on the `KIT_WORLD` (120 Hz, 32/2): owner's decision of 2026-11-26. The limit above was measured at 60 Hz with the default
 * iterations, a world the game does not run; the pile sleeps in at most 14 s.
 */
export const C7_PILE_KIT_WORLD = { median: 6, p99: 10, sleepSeconds: 14 } as const
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

/** The yaw seeds of the pile (`yaw = id * seed`): the eight of the T5.4 table, then five more, none chosen after seeing its result. */
export const ROTATION_SEEDS = [0.7, 0.3, 0.5, 0.9, 1.1, 1.3, 1.7, 2.1] as const
export const EXTRA_SEEDS = [0.4, 0.6, 1.2, 1.5, 1.9] as const
/** A death every 3 frames (20 a second): the pile of 100 forms over 5 s, a massacre fast enough to stack and slow enough that no two land in the same frame, as in the game. */
export const BIRTH_EVERY_FRAMES = 3

/** The frames the cost of the pile is read over: the 5 s of births and the 3 s after the last one (the old test read the first 3 s). */
export const COST_WINDOW_FRAMES = 100 * BIRTH_EVERY_FRAMES + 180

export interface PileRun {
  readonly costs: readonly number[]
  /** Seconds since the first death until every body sleeps; -1 if they did not in `seconds`. */
  readonly asleepAt: number
  readonly lastBirthAt: number
  /** The longest run of frames (every frame is read) with a ragdoll (R0) touching two other bodies: the rule of `design/pilha-e-lod.md` §2.1 lets it last one. */
  readonly ragdollInPile: number
  readonly counts: ReturnType<CorpseBodies['counts']>
}

const ragdollsInPile = (scene: Scene, ids: readonly number[]): number => {
  const owners = new Map<BodyId, number>()
  for (const id of ids) for (const body of scene.corpses.partsOf(id)) owners.set(body, id)
  let inPile = 0
  for (const id of ids.filter((candidate) => scene.corpses.rungOf(candidate) === 'r0')) {
    const touching = new Set<number>()
    for (const body of scene.corpses.partsOf(id)) {
      const found: BodyId[] = []
      scene.world.contactBodies(body, found)
      for (const other of found) if (owners.has(other) && owners.get(other) !== id) touching.add(owners.get(other) as number)
    }
    if (touching.size >= 2) inPile++
  }
  return inPile
}

/** 100 dead bodies dropped one at a time against the wall (`BIRTH_EVERY_FRAMES`), a frame of 1/60 s at a time, until all sleep or `limitSeconds` pass. */
export const dropPile = async (seed: number, limitSeconds: number, options: CorpseBodiesOptions = {}): Promise<{ scene: Scene; run: PileRun }> => {
  const scene = await sceneOf(options, true)
  const ids = Array.from({ length: 100 }, (_, i) => i + 1)
  const costs: number[] = []
  let asleepAt = -1
  let ragdollInPile = 0
  let ragdollRun = 0
  const lastBirthFrame = (ids.length - 1) * BIRTH_EVERY_FRAMES
  for (let f = 0; f < limitSeconds * 60; f++) {
    if (f % BIRTH_EVERY_FRAMES === 0 && f / BIRTH_EVERY_FRAMES < ids.length) {
      const id = f / BIRTH_EVERY_FRAMES + 1
      scene.corpses.add({ id, kit, position: heapAt(id - 1), yaw: id * seed })
    }
    costs.push(frame(scene.loop))
    ragdollRun = ragdollsInPile(scene, ids.filter((id) => id <= f / BIRTH_EVERY_FRAMES + 1)) > 0 ? ragdollRun + 1 : 0
    ragdollInPile = Math.max(ragdollInPile, ragdollRun)
    if (f % 6 !== 0) continue
    if (asleepAt < 0 && f > lastBirthFrame && allAsleep(scene, ids)) asleepAt = f / 60
    if (asleepAt >= 0 && f >= COST_WINDOW_FRAMES) break
  }
  return { scene, run: { costs, asleepAt, lastBirthAt: lastBirthFrame / 60, ragdollInPile, counts: scene.corpses.counts() } }
}
