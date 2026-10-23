import type { Condition, DamageMaterial, PartKind } from './types'

/** Keys of the material table. A piece / mesh refers to a key; `MaterialIds` maps it to a destruction SDK material id. */
export type MaterialKey = 'wood' | 'woodDry' | 'foliage' | 'flowers' | 'fruit' | 'pot' | 'soil' | 'cactus'
export type MaterialIds = Record<MaterialKey, string>

/**
 * Default mapping to the common destruction SDK material ids (snake_case `MaterialId` strings, see game-destruction).
 * Nothing is imported from that package: these are plain strings, override any of them with the `materialIds` option.
 */
export const DEFAULT_MATERIAL_IDS: Readonly<MaterialIds> = Object.freeze({
  wood: 'green_wood',
  woodDry: 'wood_soft',
  foliage: 'foliage',
  flowers: 'foliage',
  fruit: 'flesh_fruit',
  pot: 'ceramic',
  soil: 'soil',
  cactus: 'cactus',
})

export function resolveMaterialIds(overrides?: Partial<MaterialIds>): MaterialIds {
  return { ...DEFAULT_MATERIAL_IDS, ...(overrides ?? {}) }
}

/** Material key of a whole mesh part (wood of a dry / dead plant is dry wood; the cactus body and spines are 'cactus'). */
export function materialKeyForPart(part: PartKind, meshMaterial: DamageMaterial, condition: Condition = 'healthy'): MaterialKey {
  switch (part) {
    case 'wood':
      return condition === 'dry' || condition === 'dead' ? 'woodDry' : 'wood'
    case 'foliage':
      return meshMaterial === 'cactus' ? 'cactus' : 'foliage'
    case 'flowers':
      return 'flowers'
    case 'fruit':
      return 'fruit'
    default:
      return 'cactus'
  }
}
