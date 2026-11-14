import { afterEach } from 'vitest'

import type { PhysicsWorld } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'

// every PieceSystem made in the tests steps on the kit's own solver, unless PIECE_SOLVER=jolt (then on Jolt)
if (process.env.PIECE_SOLVER === 'jolt') {
  const engine = await createJoltEngine()
  const alive: PhysicsWorld[] = []
  // the wasm heap holds about six worlds (a fixed 128 MB, ~18 MB each): a test uses at most a few renderers at once, so the oldest of four goes when a fifth is made
  ;(globalThis as { __PIECE_PHYSICS__?: () => PhysicsWorld }).__PIECE_PHYSICS__ = () => {
    if (alive.length >= 4) alive.shift()?.dispose()
    const world = engine.createWorld({
      // the robustness sweep (C6) turns these: JOLT_STEP (Hz), JOLT_ITERATIONS (velocity), JOLT_SLOP (m), JOLT_PUSHOUT (m per position iteration)
      fixedStep: 1 / Number(process.env.JOLT_STEP ?? 120),
      velocityIterations: Number(process.env.JOLT_ITERATIONS ?? 20),
      positionIterations: Number(process.env.JOLT_POSITION_ITERATIONS ?? 2),
      sleepAfter: 0.5,
      sleepSpeed: 0.08,
      penetrationSlop: Number(process.env.JOLT_SLOP ?? 0.002),
      maxPushOut: Number(process.env.JOLT_PUSHOUT ?? 0.002),
      maxBodies: 4096,
    })
    alive.push(world)
    return world
  }
  // a test's worlds go with it (gate 0 B4): a world holds ~19 MB of the fixed 128 MB heap, so none outlives the test that made it
  afterEach(() => {
    for (const world of alive.splice(0)) world.dispose()
  })
}
