import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `sports_drink`.
 */
export const sportsDrink: ItemModelBuilder = ({ mesh, cyl, G, plastic, paper }) => {
  const bottle = mesh(cyl(0.33, 0.33, 1.83, 16), plastic(0x2080d0))
  const label = mesh(cyl(0.332, 0.332, 0.7, 16), paper(0x111111))
  const cap = mesh(cyl(0.18, 0.18, 0.14, 14), plastic(0xf06010), [0, 0.84, 0])
  return G(bottle, label, cap)
}
