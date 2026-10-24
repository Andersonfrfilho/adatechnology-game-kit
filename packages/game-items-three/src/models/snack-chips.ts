import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `snack_chips`.
 */
export const snackChips: ItemModelBuilder = ({ mesh, bx, G, plastic, paper }) => {
  const bag = mesh(bx(2.0, 2.8, 0.6), plastic(0x2a75bb))
  const band = mesh(bx(2.002, 0.8, 0.602), paper(0xf5d030))
  return G(bag, band)
}
