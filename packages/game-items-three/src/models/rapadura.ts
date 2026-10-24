import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `rapadura`.
 */
export const rapadura: ItemModelBuilder = ({ mesh, bx, G, food }) => {
  const block = mesh(bx(1.9, 1.0, 0.6), food(0x4a2a12))
  const stamp = mesh(bx(0.8, 0.4, 0.01), food(0x351c0b), [0, 0, 0.305])
  return G(block, stamp)
}
