import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `hoe`.
 */
export const hoe: ItemModelBuilder = ({ mesh, cyl, bx, G, wood, metal }) => {
  const handle = mesh(cyl(0.12, 0.12, 13.5, 12), wood(0x8a6240), [0, 0, 0], [0, 0, Math.PI / 2])
  const blade = mesh(bx(0.5, 0.6, 1.7), metal(0x555555), [6.5, 0, 0])
  return G(handle, blade)
}
