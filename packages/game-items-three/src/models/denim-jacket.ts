import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const denimJacket: ItemModelBuilder = ({ mesh, bx, G, cloth, metal }) => {
  const denim = cloth(0x3f5a85)
  const dark = cloth(0x33496d)
  const stitch = cloth(0xc9a45c)
  const button = metal(0xa9a49a)
  return G(
    mesh(bx(0.26, 0.07, 0.3), denim, [0, 0.035, 0]),
    mesh(bx(0.07, 0.06, 0.18), dark, [-0.165, 0.03, -0.06]),
    mesh(bx(0.07, 0.06, 0.18), dark, [0.165, 0.03, -0.06]),
    mesh(bx(0.07, 0.066, 0.02), denim, [-0.165, 0.033, 0.04]),
    mesh(bx(0.07, 0.066, 0.02), denim, [0.165, 0.033, 0.04]),
    mesh(bx(0.075, 0.01, 0.045), dark, [-0.04, 0.075, -0.13]),
    mesh(bx(0.075, 0.01, 0.045), dark, [0.04, 0.075, -0.13]),
    mesh(bx(0.012, 0.0702, 0.26), stitch, [0, 0.0351, 0.02]),
    mesh(bx(0.05, 0.005, 0.045), dark, [-0.075, 0.0725, -0.04]),
    mesh(bx(0.05, 0.005, 0.045), dark, [0.075, 0.0725, -0.04]),
    mesh(bx(0.008, 0.0745, 0.008), button, [0, 0.03725, -0.04]),
    mesh(bx(0.008, 0.0745, 0.008), button, [0, 0.03725, 0.03]),
    mesh(bx(0.008, 0.0745, 0.008), button, [0, 0.03725, 0.1]),
  )
}
