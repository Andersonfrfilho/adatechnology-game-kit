import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `cooking_oil`.
 */
export const cookingOil: ItemModelBuilder = ({ mesh, cyl, G, plastic, paper }) => {
  const bottle = mesh(cyl(0.35, 0.35, 2.6, 16), plastic(0xdfb828))
  const cap = mesh(cyl(0.16, 0.16, 0.18, 14), plastic(0xcc2222), [0, 1.21, 0])
  const label = mesh(cyl(0.352, 0.352, 1.0, 16), paper(0xeeeeee))
  return G(bottle, cap, label)
}
