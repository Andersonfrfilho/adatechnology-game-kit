import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `rag`.
 */
export const rag: ItemModelBuilder = ({ mesh, bx, G, cloth }) => {
  const rag = mesh(bx(2.2, 0.25, 1.8), cloth(0x758088))
  const patch = mesh(bx(1.4, 0.252, 0.9), cloth(0x556068), [-0.1, 0, 0.2])
  return G(rag, patch)
}
