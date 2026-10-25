import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `biscuits`.
 */
export const biscuits: ItemModelBuilder = ({ mesh, bx, cyl, G, paper, food }) => {
  const biscuit = food(0xc98f4e)
  const cream = food(0xe6d2a2)
  return G(
    mesh(bx(2.0, 0.24, 1.0), paper(0x2f5d8c), [0, -0.13, 0]),
    mesh(bx(0.1, 0.3, 1.0), paper(0x244a70), [-0.95, -0.1, 0]),
    mesh(bx(0.1, 0.3, 1.0), paper(0x244a70), [0.95, -0.1, 0]),
    mesh(cyl(0.38, 0.38, 0.1, 12), biscuit, [-0.45, 0.04, 0]),
    mesh(cyl(0.38, 0.38, 0.05, 12), cream, [-0.45, 0.11, 0]),
    mesh(cyl(0.38, 0.38, 0.11, 12), biscuit, [-0.45, 0.195, 0]),
    mesh(cyl(0.38, 0.38, 0.1, 12), biscuit, [0.45, 0.04, 0]),
    mesh(cyl(0.38, 0.38, 0.05, 12), cream, [0.45, 0.11, 0]),
    mesh(cyl(0.38, 0.38, 0.11, 12), biscuit, [0.45, 0.195, 0]),
  )
}
