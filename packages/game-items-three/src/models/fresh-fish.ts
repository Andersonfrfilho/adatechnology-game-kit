import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `fresh_fish`.
 */
export const freshFish: ItemModelBuilder = ({ mesh, bx, cyl, G, food }) => {
  const body = mesh(bx(3.0, 0.6, 1.0), food(0x7a8a9a))
  const tail = mesh(bx(0.5, 0.45, 0.08), food(0x5a6a7a), [-1.2, 0, 0])
  const eye = mesh(cyl(0.05, 0.05, 0.01, 8), food(0x111111), [1.1, 0.1, 0.505], [Math.PI / 2, 0, 0])
  return G(body, tail, eye)
}
