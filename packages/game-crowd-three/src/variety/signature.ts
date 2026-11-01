import { unpackIdentity } from '@adatechnology/game-characters-three'

import type { CrowdInstance, VariantSize } from '../instances'

const SCALE_STEP = 0.02
const FNV_PRIME = 0x01000193
const FNV_OFFSET = 0x811c9dc5

/**
 * The look of an instance as one number: type, variant, shirt, trousers, size, wounds and accessories (the signature of the variety test, T4b.9).
 * Two instances with the same signature look the same to the eye.
 */
export const appearanceSignature = (typeIndex: number, variant: number, instance: CrowdInstance, size: VariantSize): number => {
  const look = unpackIdentity(instance.d ?? [0, 0, 0, 0])
  const fields = [typeIndex, variant, instance.color, look.trousers, Math.round((instance.b[0] * size.s) / SCALE_STEP), Math.round((instance.b[1] * size.bulk) / SCALE_STEP), look.wounds, look.accessories, instance.c[0]]
  let hash = FNV_OFFSET
  for (const field of fields) hash = Math.imul(hash ^ (field >>> 0), FNV_PRIME) >>> 0
  return hash
}
