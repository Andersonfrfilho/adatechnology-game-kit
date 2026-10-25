import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `canned_sausages`.
 */
export const cannedSausages: ItemModelBuilder = ({ mesh, cyl, bx, G, metal, paper, food }) => G(
  mesh(cyl(0.36, 0.36, 0.81, 12), metal(0xb8bcc2)),
  mesh(cyl(0.365, 0.365, 0.04, 12), metal(0x8d9096), [0, 0.405, 0]),
  mesh(cyl(0.365, 0.365, 0.04, 12), metal(0x8d9096), [0, -0.405, 0]),
  mesh(cyl(0.365, 0.365, 0.5, 12), paper(0xa8322a), [0, 0, 0]),
  mesh(cyl(0.367, 0.367, 0.06, 12), paper(0xf1e7c8), [0, 0.2, 0]),
  mesh(cyl(0.367, 0.367, 0.06, 12), paper(0xf1e7c8), [0, -0.2, 0]),
  mesh(bx(0.4, 0.08, 0.01), food(0xd9a07a), [0, 0.05, 0.36]),
  mesh(bx(0.4, 0.08, 0.01), food(0xc78c66), [0, -0.07, 0.36]),
)
