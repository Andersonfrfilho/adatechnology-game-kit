import { buildDrum } from './drum'
import type { AttachmentModelBuilder } from './types'

const EXTENSION_FRACTION = 0.5
const MAGAZINE_LEAN = 0.08

/** The drum: the gallery's drum magazine in place of the magazine, in the frame of the magazine pivot so that it moves with the reload. */
export const buildDrumMagazine: AttachmentModelBuilder = ({ kit, factoryMagazine }) => {
  const group = kit.group()
  buildDrum(kit, group)
  return { object: group, hangsFrom: 'magazine', hides: factoryMagazine }
}

/** The extended magazine: a longer floor plate joined under the one the weapon has (+50% of the length of a box magazine). */
export const buildExtendedMagazine: AttachmentModelBuilder = ({ kit, model }) => {
  const { M, box } = kit
  const length = Math.max(0.1, (model.parts.magDrop ?? 0.16) - 0.03)
  const extension = length * EXTENSION_FRACTION
  const group = kit.group()
  const lean = Math.sin(MAGAZINE_LEAN) * (length + extension / 2)
  box(group, 0.05, extension + 0.004, 0.024, M.dark, lean, -(Math.cos(MAGAZINE_LEAN) * (length + extension / 2)), 0, MAGAZINE_LEAN)
  box(group, 0.056, 0.007, 0.028, M.dark, lean + Math.sin(MAGAZINE_LEAN) * extension / 2, -(Math.cos(MAGAZINE_LEAN) * (length + extension)) - 0.003, 0)
  return { object: group, hangsFrom: 'magazine' }
}

/** The dual coupler: the magazine of the weapon copied beside it and strapped to it, so the second one is a short reach away. */
export const buildDualCoupler: AttachmentModelBuilder = ({ kit, factoryMagazine }) => {
  const { M, box } = kit
  const group = kit.group()
  const spare = kit.group()
  spare.position.set(0, 0, 0.032)
  for (const piece of factoryMagazine) spare.add(piece.clone(true))
  group.add(spare)
  box(group, 0.05, 0.012, 0.04, M.tape, 0, -0.03, 0.016)
  return { object: group, hangsFrom: 'magazine' }
}
