import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `shovel`.
 */
export const shovel: ItemModelBuilder = ({ mesh, bx, cyl, G, metal, wood }) => {
  const steel = metal(0x7d8186)
  return G(
    mesh(cyl(1.7, 1.7, 86, 8), wood(0x9a7448), [-12, 1.8, 0], [0, 0, Math.PI / 2]),
    mesh(cyl(1.5, 1.5, 12, 8), wood(0x8a643c), [-53.8, 1.8, 0], [Math.PI / 2, 0, 0]),
    mesh(bx(10, 3.6, 3.2), steel, [30, -0.6, 0]),
    mesh(bx(31.8, 1.1, 3.6), steel, [38.9, -2.45, 0]),
    mesh(bx(26.6, 0.4, 21.6), steel, [41.3, -3.1, 0]),
    mesh(bx(3, 0.8, 22), metal(0xa4a8ad), [53.5, -3.1, 0]),
  )
}
