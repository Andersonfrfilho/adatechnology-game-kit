import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `clonazepam`.
 */
export const clonazepam: ItemModelBuilder = ({ mesh, bx, cyl, G, paper, plastic }) => {
  const carton = mesh(bx(0.9, 0.5, 0.15), paper(0xf2f2f0))
  const band = mesh(bx(0.898, 0.14, 0.152), paper(0x2b8a6e), [0, 0.18, 0])
  const label = mesh(bx(0.55, 0.22, 0.01), paper(0xffffff), [-0.1, -0.07, 0.0705])
  const title = mesh(bx(0.4, 0.04, 0.01), paper(0x2b8a6e), [-0.1, -0.02, 0.0715])
  const pill = mesh(cyl(0.065, 0.065, 0.012, 10), plastic(0x6fb6e8), [0.3, -0.07, 0.0705], [Math.PI / 2, 0, 0])
  return G(carton, band, label, title, pill)
}
