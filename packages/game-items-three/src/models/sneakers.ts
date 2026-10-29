import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const sneakers: ItemModelBuilder = ({ mesh, bx, cyl, G, cloth, plastic }) => {
  const upper = cloth(0x5a6068)
  const sole = plastic(0xe8e8e4)
  const accent = cloth(0x2e6f78)
  const lace = cloth(0xf0f0ea)
  return G(
    mesh(bx(0.25, 0.022, 0.12), sole, [-0.025, 0.011, 0]),
    mesh(cyl(0.06, 0.06, 0.022, 10), sole, [0.09, 0.011, 0]),
    mesh(bx(0.11, 0.09, 0.11), upper, [-0.095, 0.067, 0]),
    mesh(bx(0.12, 0.05, 0.11), upper, [0.0, 0.047, 0]),
    mesh(cyl(0.055, 0.055, 0.042, 10), upper, [0.095, 0.043, 0]),
    mesh(bx(0.03, 0.05, 0.08), accent, [-0.03, 0.095, 0]),
    mesh(bx(0.1, 0.03, 0.004), accent, [-0.05, 0.05, 0.057]),
    mesh(bx(0.1, 0.03, 0.004), accent, [-0.05, 0.05, -0.057]),
    mesh(bx(0.008, 0.004, 0.09), lace, [0.0, 0.074, 0]),
    mesh(bx(0.008, 0.004, 0.09), lace, [0.03, 0.074, 0]),
    mesh(bx(0.008, 0.004, 0.08), lace, [0.06, 0.066, 0]),
  )
}
