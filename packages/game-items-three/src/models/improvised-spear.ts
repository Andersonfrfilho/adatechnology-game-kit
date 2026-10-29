import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `improvised_spear`.
 */
export const improvisedSpear: ItemModelBuilder = ({ T, mesh, cyl, G, metal, wood, cloth }) => {
  const R = Math.PI / 2
  const wrap = cloth(0x4a3b2a)
  return G(
    mesh(cyl(0.1, 0.1, 13.6, 8), wood(0x7a5a38), [-1.2, 0, 0], [0, 0, R]),
    mesh(new T.ConeGeometry(0.175, 2.4, 4), metal(0x8d9095), [6.8, 0, 0], [0, 0, -R], [1, 1, 0.4]),
    mesh(cyl(0.175, 0.175, 0.8, 8), cloth(0x6b5a3e), [5.4, 0, 0], [0, 0, R]),
    mesh(cyl(0.14, 0.14, 0.7, 8), wrap, [-4.5, 0, 0], [0, 0, R]),
    mesh(cyl(0.14, 0.14, 0.7, 8), wrap, [-3.5, 0, 0], [0, 0, R]),
    mesh(cyl(0.12, 0.12, 0.3, 8), metal(0x6f7377), [4.4, 0, 0], [0, 0, R]),
  )
}
