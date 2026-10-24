import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `sickle`.
 */
export const sickle: ItemModelBuilder = ({ mesh, bx, G, wood, metal }) => {
  const blade = mesh(bx(4.0, 0.35, 3.5), metal(0x888888))
  const handle = mesh(bx(1.5, 0.352, 0.4), wood(0x5a3d24), [-1.2, 0, -1.4])
  return G(blade, handle)
}
