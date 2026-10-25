import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const militaryBackpack: ItemModelBuilder = ({ mesh, cyl, bx, G, cloth, plastic }) => {
  const main = cloth(0x4a4f35)
  const dark = cloth(0x33372a)
  return G(
    mesh(bx(0.33, 0.5, 0.18), main, [0, 0.25, -0.04]),
    mesh(bx(0.35, 0.1, 0.25), dark, [0, 0.55, -0.025]),
    mesh(bx(0.12, 0.2, 0.08), dark, [-0.11, 0.3, 0.09]),
    mesh(bx(0.12, 0.2, 0.08), dark, [0.11, 0.3, 0.09]),
    mesh(cyl(0.07, 0.07, 0.3, 8), cloth(0x5a5d40), [0, 0.07, 0.08], [0, 0, Math.PI / 2]),
    mesh(bx(0.06, 0.4, 0.02), dark, [-0.09, 0.28, -0.14]),
    mesh(bx(0.06, 0.4, 0.02), dark, [0.09, 0.28, -0.14]),
    mesh(bx(0.04, 0.03, 0.02), plastic(0x1c1d1f), [0, 0.52, 0.1]),
  )
}
