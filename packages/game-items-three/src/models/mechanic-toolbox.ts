import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `mechanic_toolbox`.
 */
export const mechanicToolbox: ItemModelBuilder = ({ mesh, bx, G, metal, plastic }) => {
  const red = metal(0xa8281f)
  const steel = metal(0x8d9196)
  const latch = (x: number) => mesh(bx(2.6, 6, 0.3), steel, [x, 2, 9.85])
  return G(
    mesh(bx(40, 12, 19.4), red, [0, -4, 0]),
    mesh(bx(40, 1.2, 19.6), metal(0x2c2e30), [0, -9.4, 0]),
    mesh(bx(40, 5, 19.4), red, [0, 4.5, 0]),
    mesh(bx(40, 0.5, 19.6), metal(0x2c2e30), [0, 2, 0]),
    mesh(bx(1.2, 2, 1.8), plastic(0x1f2022), [-7.5, 8, 0]),
    mesh(bx(1.2, 2, 1.8), plastic(0x1f2022), [7.5, 8, 0]),
    mesh(bx(16.2, 1, 1.8), plastic(0x1f2022), [0, 9.5, 0]),
    latch(-11), latch(11),
  )
}
