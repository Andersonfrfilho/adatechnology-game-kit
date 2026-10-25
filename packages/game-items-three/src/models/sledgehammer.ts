import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `sledgehammer`.
 */
export const sledgehammer: ItemModelBuilder = ({ mesh, cyl, bx, G, metal, wood, cloth }) => {
  const R = Math.PI / 2
  const steel = metal(0x55595d)
  return G(
    mesh(cyl(0.2, 0.13, 8.7, 8), wood(0x8a643c), [-0.15, 0, 0], [0, 0, R]),
    mesh(cyl(0.205, 0.205, 2.0, 8), cloth(0x22251f), [-3.2, 0, 0], [0, 0, R]),
    mesh(cyl(0.21, 0.21, 0.3, 8), wood(0x6f4f2e), [-4.35, 0, 0], [0, 0, R]),
    mesh(bx(0.9, 1.2, 1.4), steel, [4.0, 0, 0]),
    mesh(cyl(0.5, 0.5, 0.56, 8), metal(0x3a3d40), [4.0, 0, 0.97], [R, 0, 0]),
    mesh(cyl(0.5, 0.5, 0.56, 8), metal(0x3a3d40), [4.0, 0, -0.97], [R, 0, 0]),
  )
}
