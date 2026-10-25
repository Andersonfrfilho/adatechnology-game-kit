import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `instant_noodles`.
 */
export const instantNoodles: ItemModelBuilder = ({ mesh, bx, cyl, G, plastic, paper, food }) => {
  const wrap = plastic(0xd9742a)
  return G(
    mesh(bx(1.2, 1.3, 0.28), wrap),
    mesh(bx(1.2, 0.15, 0.1), plastic(0xb85a1a), [0, 0.725, 0]),
    mesh(bx(1.2, 0.15, 0.1), plastic(0xb85a1a), [0, -0.725, 0]),
    mesh(cyl(0.38, 0.38, 0.02, 12), paper(0xf3e2a8), [0, 0.05, 0.15], [Math.PI / 2, 0, 0]),
    mesh(cyl(0.3, 0.3, 0.012, 12), food(0xe6c866), [0, 0.1, 0.162], [Math.PI / 2, 0, 0]),
    mesh(bx(0.9, 0.16, 0.02), paper(0x8a2a1a), [0, -0.5, 0.15]),
  )
}
