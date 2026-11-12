import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const mechanicCoveralls: ItemModelBuilder = ({ mesh, bx, G, cloth, metal }) => {
  const fabric = cloth(0x3c5a78)
  const dark = cloth(0x2f4760)
  const zip = metal(0x9a9da0)
  return G(
    mesh(bx(0.18, 0.07, 0.136), fabric, [0, 0.035, -0.078]),
    mesh(bx(0.09, 0.07, 0.148), fabric, [-0.0465, 0.035, 0.074]),
    mesh(bx(0.09, 0.07, 0.148), fabric, [0.0465, 0.035, 0.074]),
    mesh(bx(0.11, 0.06, 0.1), fabric, [-0.145, 0.03, -0.1]),
    mesh(bx(0.11, 0.06, 0.1), fabric, [0.145, 0.03, -0.1]),
    mesh(bx(0.028, 0.062, 0.096), dark, [-0.184, 0.033, -0.1]),
    mesh(bx(0.028, 0.062, 0.096), dark, [0.184, 0.033, -0.1]),
    mesh(bx(0.18, 0.072, 0.025), dark, [0, 0.038, 0.1375]),
    mesh(bx(0.07, 0.078, 0.04), dark, [0, 0.041, -0.13]),
    mesh(bx(0.012, 0.08, 0.198), zip, [0, 0.044, -0.049]),
    mesh(bx(0.05, 0.078, 0.04), dark, [-0.05, 0.041, -0.07]),
    mesh(bx(0.05, 0.088, 0.03), dark, [0.05, 0.046, -0.02]),
    mesh(bx(0.14, 0.072, 0.012), dark, [0, 0.038, 0.0]),
  )
}
