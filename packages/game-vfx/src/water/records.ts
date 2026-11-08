import { OrderedPool } from '../pool'
import type { WaterEffectsLimits } from './types'

/** A drop thrown out of the water: it flies under gravity and, where it falls back on water, leaves a small ring. */
export interface WaterDrop {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  size: number
  age: number
  life: number
  /** The surface it was thrown from: it is gone once it falls back under it. */
  level: number
}

/** A ring on the surface. `kind` 0: a ripple that slows as it spreads; 1: the fast shock ring of a blast; 2: a wave crest going out at its speed. */
export interface WaterRing {
  x: number
  y: number
  z: number
  kind: 0 | 1 | 2
  radius: number
  startRadius: number
  maxRadius: number
  /** Seconds before it shows. */
  delay: number
  age: number
  life: number
  /** Opacity it starts with. */
  strength: number
  /** Opacity now, 0 while it waits. */
  alpha: number
}

/** A patch of white foam on the surface. */
export interface WaterFoam {
  x: number
  y: number
  z: number
  radius: number
  startRadius: number
  maxRadius: number
  age: number
  life: number
  alpha: number
}

/** A column of water thrown up (`dome` false: it rises, holds and falls back) or the dome a burst under the surface lifts. */
export interface WaterColumn {
  x: number
  y: number
  z: number
  dome: boolean
  peak: number
  baseRadius: number
  /** Top offset per metre of height, along x and z. */
  tiltX: number
  tiltZ: number
  rise: number
  delay: number
  age: number
  life: number
  height: number
  radius: number
  alpha: number
}

/** A bubble rising under the water: the trail of a round, the boil of a burst. */
export interface WaterBubble {
  x: number
  y: number
  z: number
  size: number
  rise: number
  delay: number
  age: number
  life: number
  level: number
  alpha: number
}

/** A puff of spray and steam over the water. */
export interface WaterMist {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  size: number
  age: number
  life: number
  alpha: number
}

/** A wave going out from a blast: it lifts and pushes what floats where its crest passes. */
export interface WaterWave {
  x: number
  z: number
  speed: number
  amplitude: number
  width: number
  /** Metres it can go before the shore. */
  reach: number
  delay: number
  age: number
  life: number
}

/** The default limits: enough for a rifle on full auto and a few blasts at once in the same pond. */
export const WATER_LIMITS: WaterEffectsLimits = { drops: 700, rings: 220, foam: 60, columns: 32, bubbles: 500, mist: 90, waves: 16 }

export interface WaterPools {
  readonly drops: OrderedPool<WaterDrop>
  readonly rings: OrderedPool<WaterRing>
  readonly foam: OrderedPool<WaterFoam>
  readonly columns: OrderedPool<WaterColumn>
  readonly bubbles: OrderedPool<WaterBubble>
  readonly mist: OrderedPool<WaterMist>
  readonly waves: OrderedPool<WaterWave>
}

export function createWaterPools(limits: WaterEffectsLimits): WaterPools {
  return {
    drops: new OrderedPool(limits.drops, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, age: 0, life: 0, level: 0 })),
    rings: new OrderedPool<WaterRing>(limits.rings, () => ({ x: 0, y: 0, z: 0, kind: 0, radius: 0, startRadius: 0, maxRadius: 0, delay: 0, age: 0, life: 0, strength: 0, alpha: 0 })),
    foam: new OrderedPool(limits.foam, () => ({ x: 0, y: 0, z: 0, radius: 0, startRadius: 0, maxRadius: 0, age: 0, life: 0, alpha: 0 })),
    columns: new OrderedPool<WaterColumn>(limits.columns, () => ({ x: 0, y: 0, z: 0, dome: false, peak: 0, baseRadius: 0, tiltX: 0, tiltZ: 0, rise: 0, delay: 0, age: 0, life: 0, height: 0, radius: 0, alpha: 0 })),
    bubbles: new OrderedPool(limits.bubbles, () => ({ x: 0, y: 0, z: 0, size: 0, rise: 0, delay: 0, age: 0, life: 0, level: 0, alpha: 0 })),
    mist: new OrderedPool(limits.mist, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, age: 0, life: 0, alpha: 0 })),
    waves: new OrderedPool(limits.waves, () => ({ x: 0, z: 0, speed: 0, amplitude: 0, width: 0, reach: 0, delay: 0, age: 0, life: 0 })),
  }
}
