import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `cast_iron_skillet`.
 */
export const castIronSkillet: ItemModelBuilder = ({ mesh, cyl, bx, G, metal }) => {
  const pan = mesh(cyl(1.25, 1.25, 0.5, 16), metal(0x222222), [-0.9, 0, 0])
  const handle = mesh(bx(1.8, 0.3, 0.3), metal(0x222222), [1.25, 0.1, 0])
  return G(pan, handle)
}
