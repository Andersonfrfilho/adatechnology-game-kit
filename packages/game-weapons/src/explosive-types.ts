import type { ExplosionChain } from '@adatechnology/game-contracts'

import type { DataSource } from './types'

export type ExplosiveId = string

/** What sets an explosive off: its own timer, hitting something, a bullet, fire, a trip wire, a remote detonator, or another blast nearby. */
export type ExplosiveTrigger = 'timer' | 'impact' | 'shot' | 'fire' | 'wire' | 'remote' | 'explosion'

/** Chain reaction of an explosive that sits in the world (fuel barrel, car tank, gas pump); `game-destruction` reads it from `explodes.chain`. */
export type ExplosiveChain = ExplosionChain

export interface ExplosiveDef {
  readonly id: ExplosiveId
  readonly name?: string
  readonly kind: 'fragmentation' | 'blast' | 'incendiary' | 'directional' | 'flash' | 'shaped_charge' | 'fuel'
  /** Radius in metres inside which everything dies. */
  readonly lethalRadius: number
  /** Radius in metres of the wounding area (damage falls with distance). */
  readonly injuryRadius: number
  readonly cone?: { readonly halfAngleDeg: number; readonly length: number }
  /** Joules. */
  readonly energy: number
  /** What the blast tears down: 0 nothing, 1 light, 2 walls, 3 structures. */
  readonly destructionLevel: 0 | 1 | 2 | 3
  /** Audible distance in metres. */
  readonly noise: number
  /** Seconds from arming to the blast; fixed. Overridden by `fuseLength` with `burnRate`, or by `fuseRange`. */
  readonly fuse?: number
  /** Seconds from arming to the blast, sampled per throw between the two ends (a flashbang: 1.0 to 2.3 s from the lever). */
  readonly fuseRange?: readonly [number, number]
  /** Metres of safety fuse; with `burnRate` it gives the fuse in seconds, so a longer fuse builds a delayed trap. */
  readonly fuseLength?: number
  /** Seconds the safety fuse takes to burn one metre (about 131 s/m). */
  readonly burnRate?: number
  /** Scatter of the burn rate as a fraction, sampled per throw (0.1 = ±10%). */
  readonly burnTolerance?: number
  readonly stunSeconds?: number
  readonly fire?: { temperature: number; radius: number; seconds: number }
  readonly triggers?: readonly ExplosiveTrigger[]
  readonly chain?: ExplosiveChain
  /** Kilograms. */
  readonly mass?: number
  readonly sources?: readonly DataSource[]
}
