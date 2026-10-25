import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `pickaxe`.
 */
export const pickaxe: ItemModelBuilder = ({ mesh, bx, G, wood, metal }) => {
  const handle = mesh(bx(9.0, 0.28, 0.28), wood(0x8a6240))
  const head = mesh(bx(0.6, 0.4, 3.5), metal(0x555555), [3.8, 0, 0])
  return G(handle, head)
}
