import type { DataSource } from './types'

export type ExplosiveId = string

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
  /** Seconds from arming to the blast. */
  readonly fuse?: number
  readonly stunSeconds?: number
  readonly fire?: { temperature: number; radius: number; seconds: number }
  readonly triggers?: readonly ('timer' | 'impact' | 'shot' | 'fire' | 'wire' | 'remote')[]
  /** Kilograms. */
  readonly mass?: number
  readonly sources?: readonly DataSource[]
}
