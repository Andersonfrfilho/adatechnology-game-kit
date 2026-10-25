import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `beans`.
 */
export const beans: ItemModelBuilder = ({ mesh, bx, G, food, paper }) => {
  const bag = mesh(bx(1.0, 2.0, 0.6), food(0x3a1a10))
  const label = mesh(bx(0.7, 0.9, 0.01), paper(0xddddcc), [0, 0, 0.305])
  return G(bag, label)
}
