import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `coconut_water`.
 */
export const coconutWater: ItemModelBuilder = ({ mesh, bx, cyl, G, paper, plastic }) => {
  const carton = mesh(bx(0.6, 1.7, 0.6), paper(0x2d8a4e))
  const cap = mesh(cyl(0.1, 0.1, 0.06, 12), plastic(0xffffff), [0, 0.82, 0])
  return G(carton, cap)
}
