import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `condensed_milk`.
 */
export const condensedMilk: ItemModelBuilder = ({ mesh, cyl, G, metal, paper }) => G(
  mesh(cyl(0.36, 0.36, 0.96, 12), metal(0xb8bcc2)),
  mesh(cyl(0.365, 0.365, 0.04, 12), metal(0x8d9096), [0, 0.48, 0]),
  mesh(cyl(0.365, 0.365, 0.04, 12), metal(0x8d9096), [0, -0.48, 0]),
  mesh(cyl(0.365, 0.365, 0.52, 12), paper(0xf1f1ec), [0, -0.02, 0]),
  mesh(cyl(0.367, 0.367, 0.16, 12), paper(0x2f6aa8), [0, 0.1, 0]),
  mesh(cyl(0.367, 0.367, 0.06, 12), paper(0x2f6aa8), [0, -0.2, 0]),
  mesh(cyl(0.12, 0.12, 0.008, 8), metal(0x8d9096), [0, 0.5, 0.0]),
)
