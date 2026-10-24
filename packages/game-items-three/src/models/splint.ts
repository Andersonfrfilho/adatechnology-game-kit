import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `splint`.
 */
export const splint: ItemModelBuilder = ({ mesh, bx, G, metal, plastic }) => {
  const foam = mesh(bx(4.6, 1.1, 0.1), plastic(0xee6611))
  const core = mesh(bx(4.58, 1.08, 0.05), metal(0x2070b0))
  return G(foam, core)
}
