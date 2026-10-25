import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `banana_bunch`.
 */
export const bananaBunch: ItemModelBuilder = ({ mesh, bx, G, food, wood }) => {
  const bunch = mesh(bx(3.0, 1.3, 1.7), food(0xedd034))
  const crown = mesh(bx(0.6, 0.35, 0.5), wood(0x4a3a10), [-1.2, 0.4, 0])
  const tips = mesh(bx(0.4, 0.25, 1.5), food(0x7a9a30), [1.3, -0.3, 0])
  return G(bunch, crown, tips)
}
