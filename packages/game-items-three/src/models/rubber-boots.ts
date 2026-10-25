import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const rubberBoots: ItemModelBuilder = ({ mesh, bx, cyl, G, plastic }) => {
  const rubber = plastic(0x3d5a3a)
  const sole = plastic(0x1d1d1d)
  const rim = plastic(0x2f4a2e)
  const boot = (z: number) => [
    mesh(bx(0.3, 0.025, 0.105), sole, [0, 0.0125, z]),
    mesh(bx(0.07, 0.03, 0.105), sole, [-0.115, 0.04, z]),
    mesh(bx(0.2, 0.06, 0.1), rubber, [0.04, 0.055, z]),
    mesh(cyl(0.05, 0.05, 0.06, 8), rubber, [0.1, 0.055, z]),
    mesh(cyl(0.05, 0.052, 0.325, 10), rubber, [-0.085, 0.1875, z]),
    mesh(cyl(0.054, 0.054, 0.015, 10), rim, [-0.085, 0.3425, z]),
  ]
  return G(...boot(-0.0575), ...boot(0.0575))
}
