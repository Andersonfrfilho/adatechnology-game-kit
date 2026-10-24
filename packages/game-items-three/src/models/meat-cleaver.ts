import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `meat_cleaver`.
 */
export const meatCleaver: ItemModelBuilder = ({ mesh, bx, G, metal, wood }) => {
  const blade = mesh(bx(3.3, 0.3, 1.2), metal(0xd0d0d0))
  const handle = mesh(bx(1.1, 0.302, 0.35), wood(0x654321), [-1.1, 0, -0.3])
  return G(blade, handle)
}
