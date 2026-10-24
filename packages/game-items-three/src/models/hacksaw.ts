import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `hacksaw`.
 */
export const hacksaw: ItemModelBuilder = ({ mesh, bx, G, metal }) => {
  const frame = mesh(bx(4.2, 0.3, 1.2), metal(0xdd8822))
  const blade = mesh(bx(4.0, 0.05, 0.05), metal(0xcccccc), [0, 0, -0.55])
  return G(frame, blade)
}
