import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `juice_box`.
 */
export const juiceBox: ItemModelBuilder = ({ mesh, bx, cyl, G, paper, plastic }) => {
  const body = mesh(bx(0.52, 0.88, 0.37), paper(0xe08a20), [0, -0.06, 0])
  const fin = mesh(bx(0.52, 0.12, 0.12), paper(0xc9741a), [0, 0.44, 0])
  const label = mesh(bx(0.4, 0.5, 0.02), paper(0xf6f1e4), [0, -0.05, 0.176])
  const fruit = mesh(cyl(0.1, 0.1, 0.02, 10), paper(0xd64a1a), [0, -0.02, 0.175], [Math.PI / 2, 0, 0])
  const stripe = mesh(bx(0.52, 0.08, 0.371), paper(0x6aa84f), [0, -0.38, 0])
  const straw = mesh(cyl(0.012, 0.012, 0.3, 6), plastic(0xf2f2f2), [0, 0.485, 0.06], [0, 0, Math.PI / 2])
  return G(body, fin, label, fruit, stripe, straw)
}
