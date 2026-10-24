import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `orange`.
 */
export const orange: ItemModelBuilder = ({ mesh, cyl, G, food, wood }) => {
  const fruit = mesh(cyl(0.375, 0.375, 0.75, 16), food(0xf07a10))
  const stem = mesh(cyl(0.03, 0.03, 0.05, 8), wood(0x3a5a20), [0, 0.35, 0])
  return G(fruit, stem)
}
