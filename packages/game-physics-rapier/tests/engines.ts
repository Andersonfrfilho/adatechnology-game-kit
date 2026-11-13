import * as RD from '@dimforge/rapier3d-deterministic-compat'
import * as RS from '@dimforge/rapier3d-simd-compat'
import type { PhysicsEngine } from '@adatechnology/game-physics'
import { createRapierEngine } from '../src/index'
import type { Rapier } from '../src/index'

/** Loads one build of Rapier: `deterministic` (cross-platform, no SIMD) or `simd`. RAPIER_BUILD picks the one the suites use. */
export const loadEngine = async (build: 'deterministic' | 'simd' = (process.env.RAPIER_BUILD as 'simd' | undefined) ?? 'deterministic'): Promise<{ engine: PhysicsEngine; R: Rapier; initMs: number }> => {
  const R = (build === 'simd' ? RS : RD) as unknown as Rapier
  const t0 = performance.now()
  await R.init()
  const initMs = performance.now() - t0
  return { engine: createRapierEngine({ rapier: R, deterministic: build === 'deterministic', name: `rapier-${build}` }), R, initMs }
}

export const stats = (xs: number[]): { median: number; p90: number; p99: number; max: number } => {
  const s = [...xs].sort((a, b) => a - b)
  const at = (q: number): number => s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? NaN
  return { median: at(0.5), p90: at(0.9), p99: at(0.99), max: s[s.length - 1] ?? NaN }
}

export const fmt = (x: number, d = 3): string => x.toFixed(d)
