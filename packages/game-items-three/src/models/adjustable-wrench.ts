import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `adjustable_wrench`.
 */
export const adjustableWrench: ItemModelBuilder = ({ mesh, bx, cyl, G, metal, plastic }) => {
  const steel = metal(0x8a8e93)
  return G(
    mesh(bx(17, 1.6, 2.2), steel, [-4, 0, 0]),
    mesh(cyl(0.55, 0.55, 1.65, 8), plastic(0x2a2c2e), [-11, 0, 0]),
    mesh(bx(4, 2, 6), steel, [6.5, 0, 0]),
    mesh(bx(4, 2, 2), steel, [10.5, 0, -2]),
    mesh(bx(4, 2, 1.8), steel, [10.5, 0, 2.1]),
    mesh(cyl(0.8, 0.8, 6, 8), metal(0x55595d), [6.5, 0, 0], [Math.PI / 2, 0, 0]),
  )
}
