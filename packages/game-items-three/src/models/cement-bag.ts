import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `cement_bag`.
 */
export const cementBag: ItemModelBuilder = ({ mesh, bx, G, paper }) => {
  const bag = mesh(bx(5.0, 1.0, 3.0), paper(0x9a8b7c))
  const logo = mesh(bx(3.0, 0.01, 1.6), paper(0xb83820), [0, 0.505, 0])
  return G(bag, logo)
}
