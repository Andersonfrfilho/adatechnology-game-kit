import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const hardHat: ItemModelBuilder = ({ mesh, bx, cyl, lathe, G, plastic, cloth }) => {
  const shell = plastic(0xf2b705)
  const strap = cloth(0x2b2b2b)
  return G(
    mesh(lathe([[0, 0], [0.128, 0], [0.128, 0.04], [0.118, 0.085], [0.087, 0.12], [0.041, 0.138], [0, 0.14]], 14), shell, [0, 0, -0.022]),
    mesh(cyl(0.128, 0.128, 0.012, 14), shell, [0, 0.006, -0.022]),
    mesh(bx(0.22, 0.012, 0.062), shell, [0, 0.006, 0.119]),
    mesh(bx(0.032, 0.012, 0.19), shell, [0, 0.144, -0.022]),
    mesh(bx(0.08, 0.03, 0.02), strap, [0, 0.015, -0.14]),
  )
}
