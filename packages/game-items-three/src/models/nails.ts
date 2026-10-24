import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `nails`.
 */
export const nails: ItemModelBuilder = ({ mesh, bx, cyl, G, paper, metal }) => {
  const box = mesh(bx(1.3, 0.6, 0.5), paper(0x355577))
  const nail = mesh(cyl(0.025, 0.025, 0.6, 8), metal(0xbbbbbb), [0, 0.28, 0], [0, 0, Math.PI / 2])
  return G(box, nail)
}
