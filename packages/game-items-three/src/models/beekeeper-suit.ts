import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const beekeeperSuit: ItemModelBuilder = ({ mesh, bx, cyl, G, cloth, metal }) => {
  const white = cloth(0xe3e1d6)
  const grey = cloth(0xb9b7ac)
  const straw = cloth(0xc9b27a)
  const veil = cloth(0x2e2f2c)
  return G(
    mesh(bx(0.2, 0.07, 0.33), white, [0, 0.035, 0]),
    mesh(bx(0.1, 0.06, 0.22), white, [-0.15, 0.03, -0.055]),
    mesh(bx(0.1, 0.06, 0.22), white, [0.15, 0.03, -0.055]),
    mesh(bx(0.1, 0.064, 0.025), grey, [-0.15, 0.032, 0.0675]),
    mesh(bx(0.1, 0.064, 0.025), grey, [0.15, 0.032, 0.0675]),
    mesh(bx(0.2, 0.072, 0.02), grey, [0, 0.036, 0.04]),
    mesh(bx(0.2, 0.072, 0.025), grey, [0, 0.036, 0.1525]),
    mesh(bx(0.012, 0.0702, 0.3), metal(0x9a9da0), [0, 0.0351, 0.01]),
    mesh(cyl(0.078, 0.078, 0.01, 14), straw, [0, 0.075, -0.085]),
    mesh(cyl(0.04, 0.045, 0.02, 12), straw, [0, 0.09, -0.085]),
    mesh(cyl(0.062, 0.062, 0.006, 12), veil, [0, 0.067, -0.085]),
  )
}
