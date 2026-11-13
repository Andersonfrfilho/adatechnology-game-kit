import type { PhysicsWorld } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'

// spike: every PieceSystem made in the tests steps on Jolt, unless PIECE_SOLVER=own (the kit's own solver, the baseline)
if (process.env.PIECE_SOLVER !== 'own') {
  const engine = await createJoltEngine()
  const alive: PhysicsWorld[] = []
  // the wasm heap holds about six worlds (a fixed 128 MB, ~18 MB each): a test uses at most a few renderers at once, so the oldest of four goes when a fifth is made
  ;(globalThis as { __PIECE_PHYSICS__?: () => PhysicsWorld }).__PIECE_PHYSICS__ = () => {
    if (alive.length >= 4) alive.shift()?.dispose()
    const world = engine.createWorld({
      // the robustness sweep (C6) turns these: JOLT_STEP (Hz), JOLT_ITERATIONS (velocity), JOLT_SLOP (m)
      fixedStep: 1 / Number(process.env.JOLT_STEP ?? 120),
      velocityIterations: Number(process.env.JOLT_ITERATIONS ?? 10),
      sleepAfter: 0.5,
      sleepSpeed: 0.08,
      penetrationSlop: Number(process.env.JOLT_SLOP ?? 0.002),
      maxBodies: 4096,
    })
    alive.push(world)
    return world
  }
}
