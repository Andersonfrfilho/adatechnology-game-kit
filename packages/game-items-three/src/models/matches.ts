import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `matches`.
 */
export const matches: ItemModelBuilder = ({ mesh, bx, G, paper }) => {
  const box = mesh(bx(0.5, 0.15, 0.35), paper(0xaa3322))
  const striker = mesh(bx(0.502, 0.12, 0.04), paper(0x332211), [0, 0, 0.16])
  return G(box, striker)
}
