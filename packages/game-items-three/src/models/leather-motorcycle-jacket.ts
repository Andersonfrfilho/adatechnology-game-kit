import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const leatherMotorcycleJacket: ItemModelBuilder = ({ mesh, bx, G, cloth, metal }) => {
  const leather = cloth(0x1f1d1c)
  const worn = cloth(0x2c2927)
  const zip = metal(0x9a9da0)
  const pad = cloth(0x3a3633)
  return G(
    mesh(bx(0.29, 0.08, 0.35), leather, [0, 0.04, 0]),
    mesh(bx(0.08, 0.07, 0.24), leather, [-0.185, 0.035, -0.055]),
    mesh(bx(0.08, 0.07, 0.24), leather, [0.185, 0.035, -0.055]),
    mesh(bx(0.08, 0.074, 0.03), worn, [-0.185, 0.037, 0.075]),
    mesh(bx(0.08, 0.074, 0.03), worn, [0.185, 0.037, 0.075]),
    mesh(bx(0.08, 0.09, 0.07), pad, [-0.185, 0.045, -0.12]),
    mesh(bx(0.08, 0.09, 0.07), pad, [0.185, 0.045, -0.12]),
    mesh(bx(0.09, 0.012, 0.06), worn, [-0.05, 0.086, -0.15]),
    mesh(bx(0.09, 0.012, 0.06), worn, [0.05, 0.086, -0.15]),
    mesh(bx(0.012, 0.0802, 0.3), zip, [0.015, 0.0401, 0.025]),
    mesh(bx(0.06, 0.006, 0.01), zip, [-0.07, 0.083, 0.0]),
    mesh(bx(0.06, 0.006, 0.01), zip, [0.07, 0.083, 0.0]),
    mesh(bx(0.1, 0.1, 0.03), worn, [0, 0.05, 0.16]),
  )
}
