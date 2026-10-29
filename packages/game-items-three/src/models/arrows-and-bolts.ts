import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `arrows_and_bolts`.
 */
export const arrowsAndBolts: ItemModelBuilder = ({ T, mesh, bx, cyl, G, metal, wood, cloth, plastic }) => {
  const R = Math.PI / 2
  const vane = cloth(0xb03a2e)
  const binding = cloth(0x2b2b2b)
  return G(
    mesh(cyl(0.04, 0.04, 6.45, 8), wood(0xc9ab74), [-0.225, 0, 0], [0, 0, R]),
    mesh(new T.ConeGeometry(0.125, 0.55, 4), metal(0x8d9095), [3.225, 0, 0], [0, 0, -R], [1, 1, 0.35]),
    mesh(bx(0.9, 0.02, 0.4), vane, [-2.9, 0, 0]),
    mesh(bx(0.9, 0.25, 0.02), cloth(0xe6e0d0), [-2.9, 0, 0]),
    mesh(cyl(0.05, 0.05, 0.1, 8), plastic(0xe6a23a), [-3.45, 0, 0], [0, 0, R]),
    mesh(cyl(0.055, 0.055, 0.25, 8), binding, [-2.2, 0, 0], [0, 0, R]),
    mesh(cyl(0.055, 0.055, 0.25, 8), binding, [2.85, 0, 0], [0, 0, R]),
  )
}
