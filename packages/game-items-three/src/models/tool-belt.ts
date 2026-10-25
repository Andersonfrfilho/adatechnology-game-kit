import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const toolBelt: ItemModelBuilder = ({ mesh, bx, G, cloth, metal }) => {
  const leather = cloth(0x6b4a2f)
  const pouch = cloth(0x4f3822)
  return G(
    mesh(bx(0.35, 0.04, 0.02), leather, [0, 0.05, 0.115]),
    mesh(bx(0.35, 0.04, 0.02), leather, [0, 0.05, -0.115]),
    mesh(bx(0.02, 0.04, 0.25), leather, [-0.165, 0.05, 0]),
    mesh(bx(0.02, 0.04, 0.25), leather, [0.165, 0.05, 0]),
    mesh(bx(0.08, 0.1, 0.04), pouch, [-0.1, 0.05, 0.105]),
    mesh(bx(0.08, 0.08, 0.04), pouch, [0.1, 0.04, 0.105]),
    mesh(bx(0.04, 0.09, 0.08), pouch, [-0.155, 0.045, -0.02]),
    mesh(bx(0.02, 0.08, 0.02), pouch, [0.145, 0.04, -0.09]),
    mesh(bx(0.04, 0.035, 0.012), metal(0xb0b2b5), [0, 0.05, 0.119]),
  )
}
