import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `cordless_drill`.
 */
export const cordlessDrill: ItemModelBuilder = ({ mesh, bx, G, plastic, metal }) => {
  const body = mesh(bx(1.8, 2.0, 0.7), plastic(0x228833), [-0.2, 0, 0])
  const chuck = mesh(bx(0.4, 0.5, 0.5), metal(0x222222), [0.9, 0.5, 0])
  return G(body, chuck)
}
