import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `tramadol`.
 */
export const tramadol: ItemModelBuilder = ({ mesh, bx, cyl, G, paper, plastic }) => {
  const carton = mesh(bx(0.91, 0.5, 0.0915), paper(0xf4f1e8), [0, 0, -0.00925])
  const band = mesh(bx(0.95, 0.12, 0.152), paper(0x1f4f8f), [0, -0.169, 0])
  const label = mesh(bx(0.55, 0.24, 0.03), paper(0xffffff), [-0.12, 0.06, 0.0415])
  const title = mesh(bx(0.4, 0.04, 0.025), paper(0x1f4f8f), [-0.12, 0.1, 0.064])
  const pill = mesh(cyl(0.07, 0.07, 0.03, 10), plastic(0xe6e0d0), [0.3, 0.06, 0.0415], [Math.PI / 2, 0, 0])
  return G(carton, band, label, title, pill)
}
