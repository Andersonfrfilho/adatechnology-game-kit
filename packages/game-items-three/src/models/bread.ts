import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `bread`.
 */
export const bread: ItemModelBuilder = ({ mesh, bx, G, food }) => {
  const loaf = mesh(bx(3.0, 1.0, 1.0), food(0xa0652a))
  const flour = mesh(bx(2.2, 0.01, 0.6), food(0xdfcbb5), [0, 0.505, 0])
  return G(loaf, flour)
}
