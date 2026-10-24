import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `shovel`.
 */
export const shovel: ItemModelBuilder = ({ mesh, cyl, bx, G, wood, metal }) => {
  const handle = mesh(cyl(0.15, 0.15, 11.0, 12), wood(0x8a6240), [0, 0, 0], [0, 0, Math.PI / 2])
  const blade = mesh(bx(2.5, 0.7, 2.2), metal(0x555555), [4.25, 0, 0])
  return G(handle, blade)
}
