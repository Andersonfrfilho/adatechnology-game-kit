import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const armyCamouflageUniform: ItemModelBuilder = ({ mesh, bx, G, cloth }) => {
  const base = cloth(0x59623f)
  const dark = cloth(0x363d28)
  const tan = cloth(0x8a7f55)
  return G(
    mesh(bx(0.24, 0.08, 0.32), base, [0, 0.04, 0]),
    mesh(bx(0.08, 0.07, 0.2), base, [-0.16, 0.035, -0.06]),
    mesh(bx(0.08, 0.07, 0.2), base, [0.16, 0.035, -0.06]),
    mesh(bx(0.08, 0.074, 0.024), dark, [-0.16, 0.037, 0.052]),
    mesh(bx(0.08, 0.074, 0.024), dark, [0.16, 0.037, 0.052]),
    mesh(bx(0.08, 0.01, 0.045), dark, [-0.04, 0.09, -0.135]),
    mesh(bx(0.08, 0.01, 0.045), dark, [0.04, 0.09, -0.135]),
    mesh(bx(0.09, 0.08, 0.09), dark, [-0.06, 0.042, -0.03]),
    mesh(bx(0.098, 0.08, 0.07), tan, [0.069, 0.042, 0.05]),
    mesh(bx(0.07, 0.08, 0.08), dark, [0.04, 0.042, -0.09]),
    mesh(bx(0.1, 0.08, 0.06), tan, [-0.05, 0.042, 0.11]),
    mesh(bx(0.06, 0.096, 0.06), tan, [-0.07, 0.052, -0.1]),
    mesh(bx(0.05, 0.096, 0.07), dark, [0.08, 0.052, -0.12]),
    mesh(bx(0.05, 0.081, 0.05), tan, [0.0, 0.0445, 0.13]),
  )
}
