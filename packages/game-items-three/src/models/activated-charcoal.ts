import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `activated_charcoal`.
 */
export const activatedCharcoal: ItemModelBuilder = ({ mesh, bx, G, paper }) => {
  const box = mesh(bx(0.6, 0.95, 0.25), paper(0x333333))
  const label = mesh(bx(0.5, 0.5, 0.248), paper(0xeeeeee))
  return G(box, label)
}
