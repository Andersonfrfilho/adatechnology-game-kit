import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const leatherWorkGloves: ItemModelBuilder = ({ mesh, bx, G, cloth }) => {
  const leather = cloth(0xb08a52)
  const cuff = cloth(0x8a6a3c)
  const finger = (x: number, length: number, z: number) => mesh(bx(length, 0.02, 0.022), leather, [x + length / 2, 0.01, z])
  return G(
    mesh(bx(0.055, 0.03, 0.12), cuff, [-0.0975, 0.015, 0]),
    mesh(bx(0.1, 0.022, 0.1), leather, [-0.02, 0.011, 0]),
    finger(0.03, 0.09, -0.039),
    finger(0.03, 0.095, -0.013),
    finger(0.03, 0.09, 0.013),
    finger(0.03, 0.075, 0.039),
    mesh(bx(0.05, 0.02, 0.026), leather, [-0.01, 0.01, 0.036], [0, -0.5, 0]),
    mesh(bx(0.03, 0.024, 0.1), cuff, [-0.0575, 0.012, 0]),
  )
}
