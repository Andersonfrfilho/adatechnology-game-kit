import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `rag`.
 */
export const rag: ItemModelBuilder = ({ mesh, bx, G, cloth }) => {
  const base = cloth(0xa8473a)
  const fringe = cloth(0xc47d6f)
  return G(
    mesh(bx(2.0, 0.1, 1.8), base, [0, -0.076, 0]),
    mesh(bx(1.7, 0.09, 1.5), cloth(0x9a3f33), [0.1, 0.02, 0], [0, 0.1, 0]),
    mesh(bx(1.5, 0.056, 1.2), cloth(0xb4574a), [0, 0.093, 0]),
    mesh(bx(0.2, 0.02, 1.7), fringe, [1.0, -0.076, 0]),
    mesh(bx(0.2, 0.02, 1.7), fringe, [-1.0, -0.076, 0]),
    mesh(bx(0.3, 0.006, 1.1), cloth(0x6b2a22), [0, 0.123, 0]),
  )
}
