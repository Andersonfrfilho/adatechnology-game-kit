import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `juice_box`.
 */
export const juiceBox: ItemModelBuilder = ({ mesh, bx, cyl, G, paper, plastic, metal }) => {
  const box = mesh(bx(0.52, 1.0, 0.37), paper(0xf08a24))
  const straw = mesh(cyl(0.012, 0.012, 0.7, 8), plastic(0xffffff), [0, 0, 0.17])
  const hole = mesh(cyl(0.035, 0.035, 0.01, 10), metal(0x999999), [0.15, 0.49, 0])
  return G(box, straw, hole)
}
