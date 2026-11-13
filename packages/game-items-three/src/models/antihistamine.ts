import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `antihistamine`.
 */
export const antihistamine: ItemModelBuilder = ({ mesh, bx, cyl, G, paper, plastic }) => {
  const carton = mesh(bx(0.75, 0.5, 0.0863), paper(0x7b5ea7), [0, 0, -0.00685])
  const band = mesh(bx(0.8, 0.1, 0.152), paper(0xf0eef6), [0, -0.178, 0])
  const label = mesh(bx(0.5, 0.26, 0.03), paper(0xf7f4fb), [-0.1, 0.05, 0.0414])
  const title = mesh(bx(0.36, 0.05, 0.03), paper(0x7b5ea7), [-0.1, 0.1, 0.0615])
  const pill = mesh(cyl(0.065, 0.065, 0.03, 10), plastic(0xf5f5f5), [0.28, 0.05, 0.0615], [Math.PI / 2, 0, 0])
  return G(carton, band, label, title, pill)
}
