import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `pasta`.
 */
export const pasta: ItemModelBuilder = ({ mesh, bx, G, plastic, food }) => {
  const pack = mesh(bx(1.0, 2.5, 0.4), plastic(0x153575))
  const windowMesh = mesh(bx(0.5, 1.5, 0.402), food(0xe8d070))
  return G(pack, windowMesh)
}
