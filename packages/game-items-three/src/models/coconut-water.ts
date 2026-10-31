import { asLid } from '../opening'

import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `coconut_water`.
 */
export const coconutWater: ItemModelBuilder = ({ mesh, bx, cyl, lathe, G, plastic, paper }) => {
  const bottle = mesh(lathe([[0, -0.85], [0.25, -0.85], [0.298, -0.8], [0.298, 0.3], [0.24, 0.52], [0.13, 0.66], [0.12, 0.72], [0, 0.72]], 12), plastic(0xe8efe4))
  const label = mesh(cyl(0.3, 0.3, 0.7, 12), paper(0x3f8f4a), [0, -0.15, 0])
  const nut = mesh(cyl(0.11, 0.11, 0.03, 10), paper(0x6b4a2b), [0, -0.12, 0.285], [Math.PI / 2, 0, 0])
  const leafLeft = mesh(bx(0.2, 0.05, 0.01), paper(0xe6f2d8), [-0.12, 0.08, 0.292], [0, 0, 0.5])
  const leafRight = mesh(bx(0.2, 0.05, 0.01), paper(0xe6f2d8), [0.12, 0.08, 0.292], [0, 0, -0.5])
  const cap = asLid(mesh(cyl(0.14, 0.14, 0.2, 12), plastic(0x3f8f4a), [0, 0.75, 0]))
  return G(bottle, label, nut, leafLeft, leafRight, cap)
}
