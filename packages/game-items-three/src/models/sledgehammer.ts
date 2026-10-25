import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `sledgehammer`.
 */
export const sledgehammer: ItemModelBuilder = ({ mesh, bx, G, wood, metal }) => {
  const handle = mesh(bx(9.0, 0.4, 0.4), wood(0x7a4d28))
  const head = mesh(bx(1.4, 1.2, 2.5), metal(0x3a3a3a), [3.8, 0, 0])
  return G(handle, head)
}
