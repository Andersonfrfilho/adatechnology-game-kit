import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `hatchet`.
 */
export const hatchet: ItemModelBuilder = ({ mesh, bx, G, wood, metal }) => {
  const handle = mesh(bx(3.5, 0.3, 0.3), wood(0x8a5533))
  const head = mesh(bx(0.6, 0.5, 1.3), metal(0x555555), [1.4, 0, 0])
  return G(handle, head)
}
