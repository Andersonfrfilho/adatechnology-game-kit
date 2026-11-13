import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `clonazepam`.
 */
export const clonazepam: ItemModelBuilder = ({ mesh, bx, cyl, G, paper, plastic }) => {
  const carton = mesh(bx(0.85, 0.5, 0.0863), paper(0xf2f2f0), [0, 0, -0.00685])
  const band = mesh(bx(0.9, 0.14, 0.152), paper(0x2b8a6e), [0, 0.1575, 0])
  const label = mesh(bx(0.55, 0.22, 0.03), paper(0xffffff), [-0.1, -0.07, 0.0414])
  const title = mesh(bx(0.4, 0.04, 0.03), paper(0x2b8a6e), [-0.1, -0.02, 0.0615])
  const pill = mesh(cyl(0.065, 0.065, 0.03, 10), plastic(0x6fb6e8), [0.3, -0.07, 0.0615], [Math.PI / 2, 0, 0])
  return G(carton, band, label, title, pill)
}
