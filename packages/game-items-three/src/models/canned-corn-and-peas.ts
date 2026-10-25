import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `canned_corn_and_peas`.
 */
export const cannedCornAndPeas: ItemModelBuilder = ({ mesh, cyl, G, metal, paper }) => G(
  mesh(cyl(0.36, 0.36, 0.81, 12), metal(0xb8bcc2)),
  mesh(cyl(0.365, 0.365, 0.04, 12), metal(0x8d9096), [0, 0.405, 0]),
  mesh(cyl(0.365, 0.365, 0.04, 12), metal(0x8d9096), [0, -0.405, 0]),
  mesh(cyl(0.365, 0.365, 0.5, 12), paper(0x4f8a3a), [0, 0, 0]),
  mesh(cyl(0.367, 0.367, 0.14, 12), paper(0xe9c43a), [0, 0.09, 0]),
  mesh(cyl(0.12, 0.12, 0.01, 10), paper(0xf3e08a), [-0.13, 0.0, 0.36], [Math.PI / 2, 0, 0]),
  mesh(cyl(0.1, 0.1, 0.01, 10), paper(0x7ab648), [0.12, -0.08, 0.36], [Math.PI / 2, 0, 0]),
)
