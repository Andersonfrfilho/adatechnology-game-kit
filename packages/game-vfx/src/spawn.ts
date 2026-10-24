import type { VfxCore } from './core'
import { spawnChunk } from './pools/chunks'
import type { Chunk, ChunkInit } from './pools/chunks'
import { spawnGlow } from './pools/glows'
import type { Glow, GlowInit } from './pools/glows'
import { spawnPuff } from './pools/puffs'
import type { Puff, PuffInit } from './pools/puffs'
import { spawnSpark } from './pools/sparks'
import type { Spark, SparkInit } from './pools/sparks'
import type { RandomStream } from './random'

const HOT_GLOW_COLOR = [1, 0.45, 0.12] as const

/** The spawners count what an explosion makes (the Lab's `evCount`) on top of the pools, and a hot chunk carries a halo, as in the Lab (L371-376). */
export function addPuff(core: VfxCore, random: RandomStream, init: PuffInit): Puff {
  core.spawned.puffs++
  const puff = spawnPuff(core.puffs, random, init)
  core.trace?.puff?.(puff)
  return puff
}

export function addSpark(core: VfxCore, init: SparkInit): Spark {
  core.spawned.sparks++
  const spark = spawnSpark(core.sparks, init)
  core.trace?.spark?.(spark)
  return spark
}

export function addGlow(core: VfxCore, init: GlowInit): Glow {
  const glow = spawnGlow(core.glows, init)
  core.trace?.glow?.(glow)
  return glow
}

export function addChunk(core: VfxCore, random: RandomStream, init: ChunkInit): Chunk {
  const chunk = spawnChunk(core.chunks, random, init)
  core.spawned.chunks++
  if (chunk.hot && core.layers.shrapnel) {
    chunk.glow = addGlow(core, { follow: chunk, s: 0.35 + chunk.sx, i: 2.2, life: random.between(1, 2.2), color: HOT_GLOW_COLOR, curve: 1.5 })
  }
  core.trace?.chunk?.(chunk)
  return chunk
}
