import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `frozen_chicken`.
 */
export const frozenChicken: ItemModelBuilder = ({ mesh, bx, G, food, plastic }) => {
  const chicken = mesh(bx(2.6, 1.0, 1.7), food(0xecd8b8))
  const wrapper = mesh(bx(1.0, 1.002, 1.702), plastic(0x1a4a8a))
  return G(chicken, wrapper)
}
