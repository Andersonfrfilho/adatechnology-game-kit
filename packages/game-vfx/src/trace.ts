import type { Fire } from './emitters/fire'
import type { BlastLightSpec } from './lights'
import type { Chunk } from './pools/chunks'
import type { Glow } from './pools/glows'
import type { Puff } from './pools/puffs'
import type { Spark } from './pools/sparks'
import type { MushroomSpec } from './types'

/**
 * A listener on everything an effect spawns, in the order it spawns it. It exists for the goldens (the Lab page records the same calls) and for
 * tools; nothing reads it in normal play. A record is only valid during the call: copy what you need.
 */
export interface VfxTrace {
  puff?(puff: Readonly<Puff>): void
  spark?(spark: Readonly<Spark>): void
  glow?(glow: Readonly<Glow>): void
  chunk?(chunk: Readonly<Chunk>): void
  fire?(fire: Readonly<Fire>): void
  shock?(spec: { x: number; y: number; z: number; shellRadius: number; groundRadius: number; duration: number }): void
  light?(spec: Readonly<BlastLightSpec>): void
  scorch?(x: number, z: number, radius: number): void
  crater?(x: number, z: number, radius: number, depth: number): void
  mushroom?(x: number, y: number, z: number, spec: Readonly<MushroomSpec>): void
}
