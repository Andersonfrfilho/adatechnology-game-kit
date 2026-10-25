import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `lighter`.
 */
export const lighter: ItemModelBuilder = ({ mesh, bx, cyl, G, metal, plastic }) => G(
  mesh(bx(2.46, 5.4, 1.16), plastic(0x2f6f4e), [0, -1.3, 0]),
  mesh(bx(2.5, 1.4, 1.2), plastic(0xe6e0d0), [0, -2.5, 0]),
  mesh(bx(2.4, 2.2, 1.1), metal(0xb0b4b9), [0, 2.5, 0]),
  mesh(cyl(0.6, 0.6, 0.9, 8), metal(0x55595d), [-0.5, 3.3, 0], [Math.PI / 2, 0, 0]),
  mesh(bx(0.5, 0.4, 0.4), metal(0x8d9196), [0.5, 3.8, 0]),
)
