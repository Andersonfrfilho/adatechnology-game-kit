import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `cheese`.
 */
export const cheese: ItemModelBuilder = ({ mesh, bx, cyl, G, food, extrude }) => {
  const outline: [number, number][] = [[-0.73, 0.0], [0.2, 0.44], [0.55, 0.48], [0.71, 0.3], [0.71, -0.3], [0.55, -0.48], [0.2, -0.44]]
  const hole = food(0xc99a1c)
  return G(
    mesh(extrude(outline, 0.38, 0.01), food(0xf0c64a), [0, 0.19, 0], [Math.PI / 2, 0, 0]),
    mesh(bx(0.04, 0.4, 0.6), food(0xb5482e), [0.73, 0, 0]),
    mesh(cyl(0.07, 0.07, 0.02, 8), hole, [0.1, 0.195, 0.1]),
    mesh(cyl(0.05, 0.05, 0.02, 8), hole, [0.35, 0.195, -0.15]),
    mesh(cyl(0.06, 0.06, 0.02, 8), hole, [-0.2, 0.195, -0.02]),
  )
}
