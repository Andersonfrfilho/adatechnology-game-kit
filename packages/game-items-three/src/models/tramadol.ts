import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `tramadol`.
 */
export const tramadol: ItemModelBuilder = ({ mesh, bx, G, paper, metal }) => {
  const pack = mesh(bx(0.95, 0.5, 0.15), paper(0x2a52be))
  const stripe = mesh(bx(0.952, 0.1, 0.152), metal(0xd0d0d0))
  return G(pack, stripe)
}
