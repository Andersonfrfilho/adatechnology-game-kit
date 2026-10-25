import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `tarp`.
 */
export const tarp: ItemModelBuilder = ({ mesh, bx, G, plastic, cloth }) => {
  const fold = mesh(bx(3.5, 1.0, 2.5), plastic(0x184c8a))
  const strap = mesh(bx(0.12, 1.002, 2.502), cloth(0xd0a020), [0.6, 0, 0])
  return G(fold, strap)
}
