import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `hacksaw`.
 */
export const hacksaw: ItemModelBuilder = ({ mesh, bx, cyl, G, metal, plastic }) => {
  const frame = metal(0x3f4348)
  return G(
    mesh(bx(10, 3, 4), plastic(0xc4521b), [-16, 0, 0]),
    mesh(bx(1.2, 1.4, 12), frame, [-11.4, 0, 0]),
    mesh(bx(1.2, 1.4, 12), frame, [19.8, 0, 0]),
    mesh(bx(33, 1.4, 1.2), frame, [4.5, 0, 5.4]),
    mesh(bx(31, 0.4, 0.8), metal(0xb5b9be), [4.5, 0, -5.4]),
    mesh(cyl(0.8, 0.8, 1.8, 8), metal(0x8d9196), [20.1, 0, 0], [0, 0, Math.PI / 2]),
  )
}
