import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const firefighterSuit: ItemModelBuilder = ({ mesh, bx, G, cloth, plastic }) => {
  const shell = cloth(0x6b5a34)
  const dark = cloth(0x4d4025)
  const reflective = plastic(0xcfd2c8)
  return G(
    mesh(bx(0.26, 0.09, 0.4), shell, [-0.14, 0.045, 0]),
    mesh(bx(0.26, 0.09, 0.4), shell, [0.14, 0.045, 0]),
    mesh(bx(0.24, 0.092, 0.03), reflective, [-0.14, 0.046, 0.12]),
    mesh(bx(0.24, 0.092, 0.03), reflective, [0.14, 0.046, 0.12]),
    mesh(bx(0.1, 0.092, 0.1), dark, [-0.14, 0.046, -0.04]),
    mesh(bx(0.1, 0.092, 0.1), dark, [0.14, 0.046, -0.04]),
    mesh(bx(0.34, 0.09, 0.38), shell, [0, 0.135, 0]),
    mesh(bx(0.1, 0.08, 0.3), shell, [-0.225, 0.13, -0.04]),
    mesh(bx(0.1, 0.08, 0.3), shell, [0.225, 0.13, -0.04]),
    mesh(bx(0.1, 0.084, 0.03), dark, [-0.225, 0.132, 0.095]),
    mesh(bx(0.1, 0.084, 0.03), dark, [0.225, 0.132, 0.095]),
    mesh(bx(0.342, 0.092, 0.03), reflective, [0, 0.135, 0.12]),
    mesh(bx(0.342, 0.092, 0.03), reflective, [0, 0.135, 0.04]),
    mesh(bx(0.1, 0.084, 0.03), reflective, [-0.225, 0.132, 0.03]),
    mesh(bx(0.1, 0.084, 0.03), reflective, [0.225, 0.132, 0.03]),
    mesh(bx(0.1, 0.02, 0.05), dark, [-0.045, 0.19, -0.16]),
    mesh(bx(0.1, 0.02, 0.05), dark, [0.045, 0.19, -0.16]),
  )
}
