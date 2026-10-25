import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `antivenom`.
 */
export const antivenom: ItemModelBuilder = ({ mesh, bx, G, paper }) => {
  const box = mesh(bx(1.5, 0.9, 0.5), paper(0x8a2020))
  const cross = mesh(bx(0.4, 0.4, 0.01), paper(0xffffff), [0, 0, 0.251])
  return G(box, cross)
}
