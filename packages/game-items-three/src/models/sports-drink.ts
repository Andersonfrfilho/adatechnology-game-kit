import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `sports_drink`.
 */
export const sportsDrink: ItemModelBuilder = ({ mesh, cyl, lathe, G, plastic, paper }) => {
  const bottle = mesh(lathe([[0, -0.915], [0.28, -0.915], [0.33, -0.86], [0.33, 0.28], [0.28, 0.5], [0.18, 0.64], [0.17, 0.72], [0, 0.72]], 12), plastic(0x2080d0))
  const label = mesh(cyl(0.332, 0.332, 0.7, 12), paper(0x161b22), [0, -0.12, 0])
  const stripe = mesh(cyl(0.332, 0.332, 0.1, 12), paper(0xf06010), [0, 0.28, 0])
  const collar = mesh(cyl(0.2, 0.2, 0.04, 12), plastic(0xe8e8e8), [0, 0.705, 0])
  const cap = mesh(cyl(0.19, 0.19, 0.2, 12), plastic(0xf06010), [0, 0.815, 0])
  return G(bottle, label, stripe, collar, cap)
}
