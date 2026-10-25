import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `chainsaw`.
 */
export const chainsaw: ItemModelBuilder = ({ mesh, bx, G, plastic, metal }) => {
  const motor = mesh(bx(2.3, 2.6, 2.3), plastic(0xdd5500), [-1.1, 0, 0])
  const bar = mesh(bx(2.2, 0.8, 0.1), metal(0x999999), [1.15, 0, 0])
  return G(motor, bar)
}
