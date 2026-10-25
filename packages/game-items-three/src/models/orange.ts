import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `orange`.
 */
export const orange: ItemModelBuilder = ({ T, mesh, cyl, bx, G, food }) => G(
  mesh(new T.SphereGeometry(0.375, 12, 8), food(0xe8871e)),
  mesh(cyl(0.07, 0.07, 0.02, 8), food(0x4f7a2a), [0, 0.365, 0]),
  mesh(bx(0.16, 0.012, 0.07), food(0x4f7a2a), [0.1, 0.355, 0.02], [0, 0.5, 0.2]),
  mesh(cyl(0.03, 0.03, 0.02, 6), food(0xc06a12), [0, -0.365, 0]),
)
