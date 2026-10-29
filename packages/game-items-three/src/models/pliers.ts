import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `pliers`.
 */
export const pliers: ItemModelBuilder = ({ mesh, bx, cyl, G, metal, plastic }) => {
  const steel = metal(0x7b7f84)
  const grip = plastic(0xc8541c)
  return G(
    mesh(bx(9, 3, 2), grip, [-5.5, 0, 2.5]),
    mesh(bx(9, 3, 2), grip, [-5.5, 0, -2.5]),
    mesh(bx(2, 1.2, 1.4), steel, [0, 0, 1.2]),
    mesh(bx(2, 1.2, 1.4), steel, [0, 0, -1.2]),
    mesh(bx(3, 1.6, 5), steel, [2.5, 0, 0]),
    mesh(cyl(0.9, 0.9, 3, 8), metal(0x4d5054), [2.5, 0, 0]),
    mesh(bx(6, 1.2, 2.2), steel, [7, 0, 1.4]),
    mesh(bx(6, 1.2, 2.2), steel, [7, 0, -1.4]),
  )
}
