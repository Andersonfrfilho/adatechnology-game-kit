import type { CrowdTarget } from './types'

export type CrowdView = { readonly x: number; readonly z: number; readonly yaw: number; readonly far: number }

export type CrowdUpdateContext = {
  readonly target?: CrowdTarget | null
  /** 0 day, 1 night: sight drops by 40% at night. */
  readonly nightFactor?: number
  /** Where the flow field converges (the target by default; the foot of a ladder when the target is on a roof). */
  readonly flowTarget?: readonly [number, number]
  /** Where the viewer looks (yaw: forward is `(-sin, -cos)`); the stalker wakes when the target turns its back. Default: the target's view. */
  readonly viewYaw?: number
  /** Centre of the relevance bands, for scenes without a player near the agents (tests, benches, cutscenes). Default: the target, or `flowTarget` without one. */
  readonly bandCentre?: readonly [number, number]
}

/** The same shape as `game-player`'s `PlayerCrowd` (structural, no dependency). */
export type PlayerCrowdLike = {
  count(): number
  active(i: number): boolean
  x(i: number): number
  z(i: number): number
  y(i: number): number
  floor(i: number): number
  chasing(i: number): boolean
  down(i: number): boolean
  panicWeight(i: number): number
  hold(i: number, x: number, z: number, k: number, lookX: number, lookZ: number): void
  stun(i: number, seconds: number, vx: number, vz: number): void
  chase(i: number, cooldown: number): void
  damage(i: number, hit: { region: number; amount: number; distance: number; cut: number }): void
}
