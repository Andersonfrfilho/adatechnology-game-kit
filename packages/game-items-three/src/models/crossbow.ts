import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `crossbow`.
 */
export const crossbow: ItemModelBuilder = ({ mesh, bx, G, wood, metal }) => {
  const stock = mesh(bx(7.0, 0.8, 0.6), wood(0x3d2714))
  const prod = mesh(bx(0.6, 1.2, 8.0), metal(0x444444), [2.8, 0, 0])
  return G(stock, prod)
}
