import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `pot`.
 */
export const pot: ItemModelBuilder = ({ mesh, bx, cyl, G, metal, plastic }) => {
  const steel = metal(0x9fa3a8)
  return G(
    mesh(cyl(12.2, 11.4, 12.5, 16), steel, [0, -1.25, 0]),
    mesh(cyl(12.5, 12.5, 0.8, 16), metal(0x8a8e93), [0, 4.6, 0]),
    mesh(cyl(12.2, 12.2, 0.7, 16), steel, [0, 5.35, 0]),
    mesh(cyl(4, 11, 1.1, 16), metal(0x8a8e93), [0, 6.25, 0]),
    mesh(cyl(1.3, 1, 0.7, 8), plastic(0x1f2022), [0, 7.15, 0]),
    mesh(bx(3.4, 1.2, 2.4), plastic(0x1f2022), [10.8, 3, 0]),
    mesh(bx(3.4, 1.2, 2.4), plastic(0x1f2022), [-10.8, 3, 0]),
  )
}
