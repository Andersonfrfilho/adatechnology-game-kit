import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const hoodie: ItemModelBuilder = ({ mesh, bx, cyl, G, cloth }) => {
  const fabric = cloth(0x5b6068)
  const rib = cloth(0x484c53)
  const cord = cloth(0xd8d8d0)
  return G(
    mesh(bx(0.25, 0.06, 0.28), fabric, [0, 0.03, 0]),
    mesh(bx(0.065, 0.05, 0.19), fabric, [-0.1575, 0.025, -0.045]),
    mesh(bx(0.065, 0.05, 0.19), fabric, [0.1575, 0.025, -0.045]),
    mesh(bx(0.06, 0.054, 0.025), rib, [-0.1575, 0.027, 0.0675]),
    mesh(bx(0.06, 0.054, 0.025), rib, [0.1575, 0.027, 0.0675]),
    mesh(bx(0.25, 0.062, 0.03), rib, [0, 0.031, 0.125]),
    mesh(cyl(0.062, 0.062, 0.02, 12), fabric, [0, 0.07, -0.075]),
    mesh(bx(0.15, 0.02, 0.055), rib, [0, 0.07, 0.06]),
    mesh(bx(0.006, 0.02, 0.05), cord, [-0.02, 0.07, -0.01]),
    mesh(bx(0.006, 0.02, 0.05), cord, [0.02, 0.07, -0.01]),
  )
}
