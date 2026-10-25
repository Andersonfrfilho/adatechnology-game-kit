import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `salt`.
 */
export const salt: ItemModelBuilder = ({ mesh, cyl, G, paper, plastic }) => {
  const tub = mesh(cyl(0.35, 0.35, 1.6, 16), paper(0x1a4080))
  const cap = mesh(cyl(0.352, 0.352, 0.08, 16), plastic(0xeeeeee), [0, 0.76, 0])
  return G(tub, cap)
}
