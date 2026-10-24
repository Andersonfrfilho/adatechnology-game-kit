import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `improvised_spear`.
 */
export const improvisedSpear: ItemModelBuilder = ({ mesh, cyl, bx, G, wood, metal }) => {
  const shaft = mesh(cyl(0.175, 0.175, 16.0, 16), wood(0x7a5230), [0, 0, 0], [0, 0, Math.PI / 2])
  const tip = mesh(bx(1.5, 0.176, 0.35), metal(0xd0d0d0), [7.25, 0, 0])
  return G(shaft, tip)
}
