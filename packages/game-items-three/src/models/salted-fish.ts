import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `salted_fish`.
 */
export const saltedFish: ItemModelBuilder = ({ mesh, bx, G, food, extrude }) => {
  const outline: [number, number][] = [[-1.22, 0.34], [-0.88, 0.0], [-1.22, -0.34], [-0.6, -0.46], [0.5, -0.47], [1.22, -0.3], [1.22, 0.3], [0.5, 0.47], [-0.6, 0.46]]
  const salt = food(0xf1ede2)
  return G(
    mesh(extrude(outline, 0.24, 0.02), food(0xc9b48a), [0, 0.12, 0], [Math.PI / 2, 0, 0]),
    mesh(bx(2.0, 0.01, 0.1), food(0x9a8458), [0.1, 0.145, 0]),
    mesh(bx(0.4, 0.012, 0.25), salt, [-0.3, 0.145, 0.2]),
    mesh(bx(0.5, 0.012, 0.2), salt, [0.5, 0.145, -0.22]),
    mesh(bx(0.3, 0.012, 0.18), salt, [0.7, 0.145, 0.25]),
  )
}
