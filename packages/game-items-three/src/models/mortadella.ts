import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `mortadella`.
 */
export const mortadella: ItemModelBuilder = ({ mesh, bx, cyl, G, food, metal }) => {
  const sausage = mesh(bx(1.5, 0.6, 0.5), food(0xc85560))
  const clipL = mesh(cyl(0.04, 0.04, 0.48, 8), metal(0xd0d0d0), [-0.71, 0, 0], [Math.PI / 2, 0, 0])
  const clipR = mesh(cyl(0.04, 0.04, 0.48, 8), metal(0xd0d0d0), [0.71, 0, 0], [Math.PI / 2, 0, 0])
  return G(sausage, clipL, clipR)
}
