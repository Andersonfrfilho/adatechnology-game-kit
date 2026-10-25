import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `ibuprofen`.
 */
export const ibuprofen: ItemModelBuilder = ({ mesh, bx, cyl, G, paper, plastic }) => {
  const carton = mesh(bx(0.95, 0.5, 0.15), paper(0xe9772e))
  const band = mesh(bx(0.948, 0.1, 0.152), paper(0xf6f0e2), [0, 0.2, 0])
  const label = mesh(bx(0.6, 0.24, 0.01), paper(0xfdf8ee), [-0.1, -0.05, 0.0705])
  const title = mesh(bx(0.44, 0.05, 0.01), paper(0xc3541a), [-0.1, -0.0, 0.0715])
  const pill = mesh(cyl(0.07, 0.07, 0.012, 10), plastic(0xf3d9a0), [0.3, -0.05, 0.0705], [Math.PI / 2, 0, 0])
  return G(carton, band, label, title, pill)
}
