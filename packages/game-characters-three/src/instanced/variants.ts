import { variantCountFor, variantDecay, variantSeed } from '@adatechnology/game-characters'

import type { Three, THREE_NS } from '../three'

import { bakeBody } from './bake'
import type { BakeBuilders, BakedBody } from './bake'
import { createBodyBatch } from './body-batch'
import type { BodyBatch } from './body-batch'
import { LOD_BAKE, LOD_BATCH_CAPACITY, LOD_CASTS_SHADOW } from './lod'

export type VariantType = {
  readonly id: string
  /** The name the rich builder looks the type up by (the Bestiário's `nome`). */
  readonly name: string
  readonly index: number
}

export type BodyVariant = {
  readonly typeId: string
  readonly variant: number
  readonly seed: number
  readonly decay: number
  readonly s: number
  readonly bulk: number
  /** Vertex count per level of detail. */
  readonly verts: readonly number[]
  readonly geometries: readonly THREE_NS.BufferGeometry[]
}

/**
 * The baked variants of each type (G ZVAR): `variantCountFor(type)` bodies per type, each at decay 1, 2, 1, 2 and the seed `7000 + c·101 + v·13`,
 * baked at the three levels of detail so a horde is a few draw calls.
 */
export const bakeVariants = (three: Three, builders: BakeBuilders, types: readonly VariantType[]): { readonly variants: BodyVariant[]; readonly byType: ReadonlyMap<string, readonly number[]> } => {
  const variants: BodyVariant[] = []
  const byType = new Map<string, number[]>()
  for (const type of types) {
    const indexes: number[] = []
    for (let variant = 0; variant < variantCountFor(type.id); variant++) {
      const decay = variantDecay(variant)
      const seed = variantSeed(type.index, variant)
      const baked: BakedBody[] = LOD_BAKE.map((lod) => bakeBody(three, builders, { type: type.name, decay, seed }, lod))
      indexes.push(variants.length)
      variants.push({ typeId: type.id, variant, seed, decay, s: (baked[0] as BakedBody).s, bulk: (baked[0] as BakedBody).bulk, verts: baked.map((body) => body.verts), geometries: baked.map((body) => body.geo) })
    }
    byType.set(type.id, indexes)
  }
  return { variants, byType }
}

/** The three batches of a variant (one per level of detail), sized for a horde. */
export const createVariantBatches = (three: Three, variant: BodyVariant, time: { value: number }): readonly BodyBatch[] =>
  variant.geometries.map((geometry, level) => createBodyBatch(three, geometry, { max: LOD_BATCH_CAPACITY[level] as number, castShadow: LOD_CASTS_SHADOW[level] as boolean, time }))
