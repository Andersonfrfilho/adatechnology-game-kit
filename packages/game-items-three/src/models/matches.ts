import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `matches`.
 */
export const matches: ItemModelBuilder = ({ mesh, bx, cyl, G, paper, wood, food }) => {
  const stick = wood(0xd9bb84)
  const head = food(0xb03a2a)
  const matchAt = (x: number) => [mesh(cyl(0.12, 0.12, 3.2, 6), stick, [x, 0.35, 0], [Math.PI / 2, 0, 0]), mesh(bx(0.3, 0.3, 0.4), head, [x, 0.35, 1.5])]
  return G(
    mesh(bx(5, 0.9, 3.1), paper(0xcdb07a), [0, -0.1, 0]),
    mesh(bx(2.6, 1.3, 3.5), paper(0x9c3b2e), [1, -0.1, 0]),
    mesh(bx(2.2, 0.2, 1.2), paper(0x4a3f38), [1, 0.65, 0]),
    ...matchAt(-2.1),
    ...matchAt(-1.7),
    ...matchAt(-1.3),
  )
}
