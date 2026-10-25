import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `tramadol`.
 */
export const tramadol: ItemModelBuilder = ({ mesh, bx, cyl, G, paper, plastic }) => {
  const carton = mesh(bx(0.95, 0.5, 0.15), paper(0xf4f1e8))
  const band = mesh(bx(0.948, 0.12, 0.152), paper(0x1f4f8f), [0, -0.19, 0])
  const label = mesh(bx(0.55, 0.24, 0.01), paper(0xffffff), [-0.12, 0.06, 0.0705])
  const title = mesh(bx(0.4, 0.04, 0.01), paper(0x1f4f8f), [-0.12, 0.1, 0.0715])
  const pill = mesh(cyl(0.07, 0.07, 0.01, 10), plastic(0xe6e0d0), [0.3, 0.06, 0.0705], [Math.PI / 2, 0, 0])
  return G(carton, band, label, title, pill)
}
