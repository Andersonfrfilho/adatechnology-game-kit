import type { DamageType, MaterialDef } from '@adatechnology/game-destruction'

import type { SoundDetail } from '../types'

/**
 * The sound family of a material, from its tags: what it sounds like when something meets it. Finer than the five keys of `impactKey` (which stay the
 * last fallback): ceramic is not glass, the ground is not concrete, plastic and wax are not wood, leaves are not a sofa.
 */
export type ImpactFamily = 'metal' | 'glass' | 'ceramic' | 'soil' | 'masonry' | 'wood' | 'plant' | 'plastic' | 'rubber' | 'wax' | 'soft'

/** Tag → family, in the order they are tried (`green_wood` is `plant` and `wood`: wood wins; `gravel` is `soil` and `masonry`: soil wins). */
export const IMPACT_FAMILY_TAGS: readonly (readonly [tag: string, family: ImpactFamily])[] = [
  ['metal', 'metal'],
  ['glass', 'glass'],
  ['ceramic', 'ceramic'],
  ['soil', 'soil'],
  ['masonry', 'masonry'],
  ['wood', 'wood'],
  ['plant', 'plant'],
  ['plastic', 'plastic'],
  ['rubber', 'rubber'],
  ['wax', 'wax'],
  ['fabric', 'soft'],
]

/** The family of a material, or `undefined` when none of its tags names one (the five legacy keys of `impactKey` then answer). */
export function impactFamily(def: MaterialDef | undefined): ImpactFamily | undefined {
  const tags = def?.tags ?? []
  for (const [tag, family] of IMPACT_FAMILY_TAGS) if (tags.includes(tag)) return family
  return undefined
}

/** What an impact or a break sends with its key: the keys to try before it, most specific first (material and blow, material, family and blow, family). */
export type ImpactKeys = SoundDetail & { readonly keys: readonly string[] }

const ordered = (prefix: string, material: string, family: ImpactFamily | undefined, blow: DamageType | undefined): string[] => {
  const keys: string[] = []
  if (material && blow) keys.push(`${prefix}_${material}_${blow}`)
  if (material) keys.push(`${prefix}_${material}`)
  if (family && blow) keys.push(`${prefix}_${family}_${blow}`)
  if (family) keys.push(`${prefix}_${family}`)
  return keys
}

/**
 * The impact keys for a blow on a material, most specific first: `impact_<material>_<blow>`, `impact_<material>`, `impact_<family>_<blow>`,
 * `impact_<family>` (blow is the `DamageType`: `ballistic`, `blunt`, `slash`, `explosive`...). The legacy `impactKey` is the last fallback the caller sends as the key.
 */
export function impactSoundKeys(material: string, def: MaterialDef | undefined, blow?: DamageType): ImpactKeys {
  return { keys: ordered('impact', material, impactFamily(def), blow) }
}

/** The keys for a part of this material breaking, most specific first: `break_<material>_<blow>`, `break_<material>`, `break_<family>_<blow>`, `break_<family>`. */
export function breakSoundKeys(material: string, def: MaterialDef | undefined, blow?: DamageType): ImpactKeys {
  return { keys: ordered('break', material, impactFamily(def), blow) }
}

/** The keys for a round glancing off a part of this material: `ricochet_<material>`, `ricochet_<family>` (then the plain `ricochet`). */
export function ricochetSoundKeys(material: string, def: MaterialDef | undefined): ImpactKeys {
  return { keys: ordered('ricochet', material, impactFamily(def), undefined) }
}
