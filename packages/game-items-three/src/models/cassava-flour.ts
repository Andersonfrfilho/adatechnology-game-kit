import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `cassava_flour`.
 */
export const cassavaFlour: ItemModelBuilder = ({ mesh, bx, G, food, plastic, paper }) => {
  const bag = mesh(bx(1.5, 2.5, 0.6), food(0xf5eedb))
  const tie = mesh(bx(0.6, 0.1, 0.2), plastic(0xcc2222), [0, 1.2, 0])
  const label = mesh(bx(1.0, 1.0, 0.01), paper(0x335522), [0, 0, 0.305])
  return G(bag, tie, label)
}
