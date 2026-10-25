import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `screws`.
 */
export const screws: ItemModelBuilder = ({ mesh, bx, cyl, G, paper, metal }) => {
  const box = mesh(bx(0.9, 0.5, 0.5), paper(0x8a7050))
  const screw = mesh(cyl(0.03, 0.03, 0.4, 8), metal(0xaaaaaa), [0, 0.23, 0], [0, 0, Math.PI / 2])
  return G(box, screw)
}
