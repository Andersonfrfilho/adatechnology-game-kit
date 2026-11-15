import { afterEach } from 'vitest'

import { KIT_WORLD, createPhysicsLoop, isPhysicsLoop } from '@adatechnology/game-physics'
import type { PhysicsLoop, PhysicsWorld, SeamWorld } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import type { PiecePhysics } from '@adatechnology/game-destruction-three'

// every renderer made in the tests steps on the kit's own solver, unless PIECE_SOLVER=jolt (then on Jolt); the one place that decides, so the tests change in one spot
export const IS_JOLT = process.env.PIECE_SOLVER === 'jolt'

const engine = IS_JOLT ? await createJoltEngine() : null
const alive: PhysicsWorld[] = []

const newWorld = (): PhysicsWorld => {
  if (!engine) throw new Error('setup-physics: a world is only made with PIECE_SOLVER=jolt')
  // the wasm heap holds about six worlds (a fixed 128 MB, ~18 MB each): a test uses at most a few renderers at once, so the oldest of four goes when a fifth is made
  if (alive.length >= 4) alive.shift()?.dispose()
  const world = engine.createWorld({
    ...KIT_WORLD,
    // the robustness sweep (C6) turns these: JOLT_STEP (Hz), JOLT_ITERATIONS (velocity), JOLT_SLOP (m), JOLT_PUSHOUT (m per position iteration)
    fixedStep: 1 / Number(process.env.JOLT_STEP ?? 120),
    velocityIterations: Number(process.env.JOLT_ITERATIONS ?? KIT_WORLD.velocityIterations),
    positionIterations: Number(process.env.JOLT_POSITION_ITERATIONS ?? KIT_WORLD.positionIterations),
    penetrationSlop: Number(process.env.JOLT_SLOP ?? KIT_WORLD.penetrationSlop),
    maxPushOut: Number(process.env.JOLT_PUSHOUT ?? KIT_WORLD.maxPushOut),
  })
  alive.push(world)
  return world
}

/** A new world each call (Jolt) or `'own'`: what a seam is handed to step itself (the one-system mode). */
export const physicsOption = (): SeamWorld | 'own' => (IS_JOLT ? newWorld() : 'own')

/** The game's mode: a new world and its loop (Jolt), or `'own'`; step it with `tick`. */
export const physicsLoop = (): PhysicsLoop | 'own' => (IS_JOLT ? createPhysicsLoop(newWorld()) : 'own')

/** One frame the host's way: the loop steps, then the seam draws. Under `'own'` or a world the seam steps itself, so it is only `update`. */
export const tick = (physics: PiecePhysics, renderer: { update(dt: number): void }, dt: number): void => {
  if (physics !== 'own' && isPhysicsLoop(physics)) physics.step(dt)
  renderer.update(dt)
}

// a test's worlds go with it (gate 0 B4): a world holds ~19 MB of the fixed 128 MB heap, so none outlives the test that made it
afterEach(() => {
  for (const world of alive.splice(0)) world.dispose()
})
