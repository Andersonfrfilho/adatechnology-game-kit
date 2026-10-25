import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `bucket`.
 */
export const bucket: ItemModelBuilder = ({ mesh, cyl, G, plastic, metal }) => {
  const bucket = mesh(cyl(1.4, 1.2, 2.7, 16), plastic(0x2255aa))
  const rim = mesh(cyl(1.402, 1.402, 0.1, 16), metal(0x888888), [0, 1.3, 0])
  return G(bucket, rim)
}
