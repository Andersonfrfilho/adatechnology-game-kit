import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `dog_food`.
 */
export const dogFood: ItemModelBuilder = ({ mesh, bx, G, paper }) => {
  const bag = mesh(bx(1.8, 2.6, 0.7), paper(0x355a8a))
  const label = mesh(bx(1.2, 1.2, 0.01), paper(0xea8a25), [0, 0, 0.355])
  return G(bag, label)
}
