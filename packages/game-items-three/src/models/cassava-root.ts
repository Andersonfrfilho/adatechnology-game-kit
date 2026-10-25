import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `cassava_root`.
 */
export const cassavaRoot: ItemModelBuilder = ({ mesh, cyl, G, food }) => {
  const tuber = mesh(cyl(0.35, 0.35, 4.0, 16), food(0x4a2e1b), [0, 0, 0], [0, 0, Math.PI / 2])
  const cutEnd = mesh(cyl(0.34, 0.34, 0.04, 16), food(0xf0eee0), [1.98, 0, 0], [0, 0, Math.PI / 2])
  return G(tuber, cutEnd)
}
