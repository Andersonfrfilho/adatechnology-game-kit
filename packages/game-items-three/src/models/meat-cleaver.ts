import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `meat_cleaver`.
 */
export const meatCleaver: ItemModelBuilder = ({ mesh, bx, cyl, G, metal, wood }) => {
  const steel = metal(0xa9adb0)
  const rivet = metal(0xb8913a)
  return G(
    mesh(bx(2.15, 0.07, 1.2), steel, [-0.575, 0, 0]),
    mesh(bx(2.15, 0.14, 0.2), metal(0x8c9094), [-0.575, 0, -0.5]),
    mesh(bx(2.15, 0.03, 0.14), metal(0xd4d7da), [-0.575, 0, 0.53]),
    mesh(cyl(0.1, 0.1, 0.08, 8), metal(0x2a2c2e), [-1.25, 0, -0.1]),
    mesh(bx(1.2, 0.3, 0.28), wood(0x3b2a20), [1.05, 0, -0.3]),
    mesh(bx(0.12, 0.2, 0.4), metal(0x6f7377), [0.5, 0, -0.3]),
    mesh(cyl(0.04, 0.04, 0.3, 8), rivet, [0.8, 0, -0.3]),
    mesh(cyl(0.04, 0.04, 0.3, 8), rivet, [1.3, 0, -0.3]),
  )
}
