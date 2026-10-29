import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `salt`.
 */
export const salt: ItemModelBuilder = ({ mesh, cyl, G, paper, plastic }) => G(
  mesh(cyl(0.345, 0.345, 1.3, 12), paper(0xeeeeea), [0, -0.15, 0]),
  mesh(cyl(0.25, 0.345, 0.15, 12), paper(0xd6d6d0), [0, 0.575, 0]),
  mesh(cyl(0.12, 0.12, 0.15, 12), plastic(0x2f6aa8), [0, 0.725, 0]),
  mesh(cyl(0.35, 0.35, 0.7, 12), paper(0x2f6aa8), [0, -0.3, 0]),
  mesh(cyl(0.352, 0.352, 0.3, 12), paper(0xeeeeea), [0, -0.3, 0]),
  mesh(cyl(0.35, 0.35, 0.06, 12), paper(0x244a70), [0, -0.78, 0]),
)
