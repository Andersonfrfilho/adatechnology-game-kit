import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const mechanicCoveralls: ItemModelBuilder = ({ mesh, bx, G, cloth, metal }) => {
  const fabric = cloth(0x3c5a78)
  const dark = cloth(0x2f4760)
  const zip = metal(0x9a9da0)
  return G(
    mesh(bx(0.18, 0.07, 0.14), fabric, [0, 0.035, -0.08]),
    mesh(bx(0.09, 0.07, 0.15), fabric, [-0.0465, 0.035, 0.075]),
    mesh(bx(0.09, 0.07, 0.15), fabric, [0.0465, 0.035, 0.075]),
    mesh(bx(0.11, 0.06, 0.1), fabric, [-0.145, 0.03, -0.1]),
    mesh(bx(0.11, 0.06, 0.1), fabric, [0.145, 0.03, -0.1]),
    mesh(bx(0.03, 0.064, 0.1), dark, [-0.185, 0.032, -0.1]),
    mesh(bx(0.03, 0.064, 0.1), dark, [0.185, 0.032, -0.1]),
    mesh(bx(0.18, 0.074, 0.025), dark, [0, 0.037, 0.1375]),
    mesh(bx(0.07, 0.08, 0.04), dark, [0, 0.04, -0.13]),
    mesh(bx(0.012, 0.0802, 0.2), zip, [0, 0.0401, -0.05]),
    mesh(bx(0.05, 0.08, 0.04), dark, [-0.05, 0.04, -0.07]),
    mesh(bx(0.05, 0.09, 0.03), dark, [0.05, 0.045, -0.02]),
    mesh(bx(0.14, 0.071, 0.012), dark, [0, 0.0355, 0.0]),
  )
}
