import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `recurve_bow`.
 */
export const recurveBow: ItemModelBuilder = ({ mesh, bx, G, wood, cloth }) => {
  const stave = mesh(bx(13.0, 2.0, 0.5), wood(0x5a3d24))
  const string = mesh(bx(12.8, 0.05, 0.05), cloth(0xdedede), [0, -0.9, 0])
  return G(stave, string)
}
