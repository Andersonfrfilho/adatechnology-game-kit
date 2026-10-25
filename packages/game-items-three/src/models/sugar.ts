import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `sugar`.
 */
export const sugar: ItemModelBuilder = ({ mesh, bx, G, paper }) => G(
  mesh(bx(1.0, 1.7, 0.58), paper(0xf4f1ea), [0, -0.15, 0]),
  mesh(bx(1.0, 0.3, 0.34), paper(0xe4dfd0), [0, 0.85, 0]),
  mesh(bx(1.0, 0.05, 0.12), paper(0xc9c3b0), [0, 0.975, 0]),
  mesh(bx(0.7, 0.8, 0.02), paper(0x3f6f94), [0, -0.1, 0.3]),
  mesh(bx(0.5, 0.14, 0.022), paper(0xf4f1ea), [0, 0.1, 0.3]),
  mesh(bx(0.5, 0.14, 0.022), paper(0xf4f1ea), [0, -0.3, 0.3]),
)
