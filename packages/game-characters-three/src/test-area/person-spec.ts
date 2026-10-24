import type { ProfessionCard } from './types'

const hex = (value: string): number => parseInt(value, 16)

/** The person builder's spec for a profession of the people pack (look and gear as numbers; the builder draws the rest). */
export const personSpecOf = (profession: ProfessionCard): Record<string, any> => {
  const { look } = profession
  const spec: Record<string, any> = {
    skin: hex(look.skin),
    hair: { s: look.hair.style, c: hex(look.hair.color) },
    top: { c: hex(look.top.color), sl: look.top.sleeve, ...(look.top.plaid ? { plaid: hex(look.top.plaid) } : {}) },
    pants: { c: hex(look.pants.color) },
    shoes: hex(look.shoes),
    ex: profession.accessories.map((accessory) => (accessory.color ? [accessory.id, hex(accessory.color)] : [accessory.id])),
  }
  if (profession.female) spec.fem = 1
  if (look.hat) spec.hat = { k: look.hat.kind, c: hex(look.hat.color) }
  if (look.face && look.face.length > 0) spec.face = [...look.face]
  if (profession.hand) spec.hand = profession.hand
  if (profession.leftHand) spec.lhand = profession.leftHand
  return spec
}
