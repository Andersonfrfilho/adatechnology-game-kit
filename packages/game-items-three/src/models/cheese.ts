import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `cheese`.
 */
export const cheese: ItemModelBuilder = ({ mesh, bx, G, food }) => {
  const cheese = mesh(bx(1.5, 0.4, 1.0), food(0xf3e5ab))
  const rind = mesh(bx(1.502, 0.402, 0.05), food(0xddcc88), [0, 0, -0.475])
  return G(cheese, rind)
}
