import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `ibuprofen`.
 */
export const ibuprofen: ItemModelBuilder = ({ mesh, bx, cyl, G, paper, plastic }) => {
  const carton = mesh(bx(0.95, 0.5, 0.1285), paper(0xe9772e), [0, 0, -0.01175])
  const band = mesh(bx(0.91, 0.08, 0.127), paper(0xf6f0e2), [0, 0.19, 0.001])
  const label = mesh(bx(0.6, 0.24, 0.012), paper(0xfdf8ee), [-0.1, -0.05, 0.0585])
  const title = mesh(bx(0.44, 0.05, 0.012), paper(0xc3541a), [-0.1, -0.0, 0.0705])
  const pill = mesh(cyl(0.07, 0.07, 0.024, 10), plastic(0xf3d9a0), [0.3, -0.05, 0.0645], [Math.PI / 2, 0, 0])
  return G(carton, band, label, title, pill)
}
