import type { PersonExtra, PersonSpec } from '../rich/types'

import type { ProfessionCard } from './types'

const hex = (value: string): number => parseInt(value, 16)

/** The person builder's spec for a profession of the people pack (look and gear as numbers; the builder draws the rest). */
export const personSpecOf = (profession: ProfessionCard): PersonSpec => {
  const { look } = profession
  const ex: PersonExtra[] = profession.accessories.map((accessory): PersonExtra => (accessory.color ? [accessory.id, hex(accessory.color)] : [accessory.id]))
  return {
    skin: hex(look.skin),
    hair: { s: look.hair.style, c: hex(look.hair.color) },
    top: { c: hex(look.top.color), sl: look.top.sleeve, ...(look.top.plaid ? { plaid: hex(look.top.plaid) } : {}) },
    pants: { c: hex(look.pants.color) },
    shoes: hex(look.shoes),
    ex,
    ...(profession.female ? { fem: 1 } : {}),
    ...(look.hat ? { hat: { k: look.hat.kind, c: hex(look.hat.color) } } : {}),
    ...(look.face && look.face.length > 0 ? { face: [...look.face] } : {}),
    ...(profession.hand ? { hand: profession.hand } : {}),
    ...(profession.leftHand ? { lhand: profession.leftHand } : {}),
  }
}
