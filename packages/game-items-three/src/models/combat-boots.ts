import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const combatBoots: ItemModelBuilder = ({ mesh, bx, cyl, G, cloth, plastic }) => {
  const leather = cloth(0x1f1e1c)
  const sole = plastic(0x111111)
  const lace = cloth(0x3a3835)
  const boot = (z: number) => [
    mesh(bx(0.3, 0.02, 0.105), sole, [0, 0.01, z]),
    mesh(bx(0.07, 0.016, 0.105), sole, [-0.105, 0.028, z]),
    mesh(bx(0.2, 0.06, 0.095), leather, [0.04, 0.05, z]),
    mesh(cyl(0.0475, 0.0475, 0.06, 8), leather, [0.1025, 0.05, z]),
    mesh(cyl(0.045, 0.05, 0.18, 8), leather, [-0.085, 0.11, z]),
    mesh(bx(0.012, 0.004, 0.07), lace, [0.0, 0.082, z]),
    mesh(bx(0.012, 0.004, 0.07), lace, [0.035, 0.082, z]),
  ]
  return G(...boot(-0.0575), ...boot(0.0575))
}
