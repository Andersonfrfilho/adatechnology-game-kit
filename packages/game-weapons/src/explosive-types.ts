import type { ExplosionChain } from '@adatechnology/game-contracts'

import type { DataSource } from './types'

export type ExplosiveId = string

/** What sets an explosive off: its own timer, hitting something, a bullet, fire, a trip wire, a remote detonator, or another blast nearby. */
export type ExplosiveTrigger = 'timer' | 'impact' | 'shot' | 'fire' | 'wire' | 'remote' | 'explosion'

/** Chain reaction of an explosive that sits in the world (fuel barrel, car tank, gas pump); `game-destruction` reads it from `explodes.chain`. */
export type ExplosiveChain = ExplosionChain

/** The wire a placed charge stretches: from the charge, `length` metres out at `angleDeg` from the way it faces, `height` metres above where it sits. */
export interface ExplosiveTripwire {
  /** Metres. */
  readonly length: number
  /** Degrees from the facing of the charge, counter-clockwise seen from above (default 0: straight ahead). */
  readonly angleDeg?: number
  /** Metres above the charge (default 0.15: shin height). */
  readonly height?: number
}

/**
 * What a world explosive holds and how it behaves once the shell is punctured or its valve is opened (a pressure vessel: the P13 cylinder). `game-destruction` reads `fluid`,
 * `liters` and `pressurized` from `PartSpec.contains`; the host plays the timings (Laboratório de Explosões, `SC.p13` L894-911).
 */
export interface ExplosiveLeak {
  /** What escapes (`gas`: flammable, it lights from a spark, a flame or a blast). */
  readonly fluid: string
  /** Litres of it at the start (13 kg of liquid propane at 0.54 kg per litre is about 24 l). */
  readonly liters: number
  readonly pressurized: boolean
  /** Seconds from the first leak to the jet catching fire as a torch when nothing lit it before (the lab: the white jet runs 0.8 s, then it lights). */
  readonly igniteDelay: number
  /** Seconds the white jet hisses and shoves the vessel before it lights (the lab's 0 to 0.8 s). */
  readonly hissSeconds?: number
}

/** What is left of the vessel after the blast: the torn shell flies off trailing fire (the lab: `vy` 13 m/s, a fire trail for about 1.8 s). */
export interface ExplosiveShell {
  /** Metres per second, upwards. */
  readonly launchSpeed: number
  /** Seconds the flying shell trails fire. */
  readonly trailSeconds: number
}

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
  /** A world explosive that is a pressure vessel (the P13 cylinder): the gas it holds and when a leak catches fire. Absent: a bullet only primes it. */
  readonly leak?: ExplosiveLeak
  /** What is left of the vessel after the blast (see `ExplosiveShell`). */
  readonly shell?: ExplosiveShell
  /** The trip wire of an explosive with the `wire` trigger; without it the one in `rules.explosives.tripwire` is used. */
  readonly tripwire?: ExplosiveTripwire
  /** Kilograms. */
  readonly mass?: number
  readonly sources?: readonly DataSource[]
}
