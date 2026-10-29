import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `police_baton`.
 */
export const policeBaton: ItemModelBuilder = ({ mesh, cyl, G, plastic, metal }) => {
  const R = Math.PI / 2
  const black = plastic(0x1b1c1d)
  return G(
    mesh(cyl(0.22, 0.22, 5, 8), black, [0, 0, 0], [0, 0, R]),
    mesh(cyl(0.225, 0.225, 0.3, 8), metal(0x3a3d40), [2.35, 0, 0], [0, 0, R]),
    mesh(cyl(0.225, 0.225, 0.3, 8), metal(0x3a3d40), [-2.35, 0, 0], [0, 0, R]),
    mesh(cyl(0.12, 0.12, 0.6, 8), black, [-1.35, -0.36, 0]),
    mesh(cyl(0.16, 0.16, 0.115, 8), plastic(0x2a2c2e), [-1.35, -0.7175, 0]),
    mesh(cyl(0.13, 0.13, 0.06, 8), plastic(0x3a3d40), [-1.35, -0.2, 0]),
    mesh(cyl(0.13, 0.13, 0.06, 8), plastic(0x3a3d40), [-1.35, -0.32, 0]),
    mesh(cyl(0.13, 0.13, 0.06, 8), plastic(0x3a3d40), [-1.35, -0.44, 0]),
  )
}
