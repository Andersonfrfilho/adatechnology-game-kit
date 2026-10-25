import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `hoe`.
 */
export const hoe: ItemModelBuilder = ({ mesh, bx, cyl, G, metal, wood }) => {
  const steel = metal(0x7d8186)
  return G(
    mesh(cyl(1.3, 1.3, 122, 8), wood(0x9a7448), [-6.5, 1.7, 0], [0, 0, Math.PI / 2]),
    mesh(bx(8, 2.6, 3), steel, [58.5, 1.7, 0]),
    mesh(bx(5, 2.2, 2.6), steel, [65, 0.4, 0]),
    mesh(bx(0.8, 6, 17), steel, [67.1, 0, 0]),
    mesh(bx(1.6, 1, 17), metal(0xa4a8ad), [66.7, -2.5, 0]),
    mesh(bx(1.6, 1, 10), metal(0x5d6166), [65.9, 0.5, 0]),
  )
}
