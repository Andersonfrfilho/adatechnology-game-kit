import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `raffia_sack`.
 */
export const raffiaSack: ItemModelBuilder = ({ mesh, bx, G, cloth }) => {
  const bag = mesh(bx(4.0, 0.2, 3.0), cloth(0xdcd5be))
  const stripe = mesh(bx(4.002, 0.202, 0.4), cloth(0x225588))
  return G(bag, stripe)
}
