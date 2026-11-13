import { beforeAll, describe, expect, it } from 'vitest'
import type { PhysicsEngine } from '@adatechnology/game-physics'
import { loadRapierEngine } from '@adatechnology/game-physics-rapier'
import { engineBowl } from './engine-bowl'

const SEEDS = Number(process.env.BOWL_SEEDS ?? 16)
const MAX_STEP = Number(process.env.BOWL_MAX_STEP ?? 1 / 60)
const ITERATIONS = process.env.BOWL_ITERATIONS ? Number(process.env.BOWL_ITERATIONS) : undefined
let engine: PhysicsEngine

beforeAll(async () => {
  engine = await loadRapierEngine()
})

describe('deepening bowl through the physics contract (Rapier): C1-C4 of DECISION-fable §2', () => {
  for (const dt of [0.05, 1 / 60]) {
    it.each(Array.from({ length: SEEDS }, (_, i) => i + 1))(`dt ${dt.toFixed(3)} seed %i`, (seed) => {
      const r = engineBowl(seed, dt, engine, { maxStep: MAX_STEP, solverIterations: ITERATIONS })
      if (process.env.BOWL_REPORT)
        console.log(
          `bowl dt ${dt.toFixed(3)} seed ${seed} restGain ${r.restGain.toFixed(4)} lift ${r.lift.toFixed(4)} created ${r.created.toFixed(4)} over1mm ${r.createdOver1mm} asleep ${r.asleepAtEnd}/${r.pieces} ms ${r.msPerUpdate.toFixed(3)} ground ${r.groundMsPerUpdate.toFixed(3)} awake ${r.awakeIds} hash ${r.poseHash}`,
        )
      expect(r.restGain).toBeLessThanOrEqual(0.035)
      expect(r.lift).toBeLessThanOrEqual(0.035)
      expect(r.asleepAtEnd).toBe(r.pieces)
    }, 120_000)
  }
})
