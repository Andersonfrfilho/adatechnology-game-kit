import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const headlamp: ItemModelBuilder = ({ M, mesh, cyl, bx, G, cloth, plastic }) => {
  const quarter = Math.PI / 2
  const strap = cloth(0x1d2a35)
  return G(
    mesh(bx(0.05, 0.045, 0.024), plastic(0x2b2f33), [0, 0.0225, 0.002]),
    mesh(cyl(0.017, 0.017, 0.011, 12), M(0xfff1c0, 'glass', { emissive: 0xffe08a, emissiveIntensity: 0.6 }), [0, 0.0225, 0.0195], [quarter, 0, 0]),
    mesh(bx(0.012, 0.015, 0.04), strap, [0, 0.0525, -0.005]),
    mesh(bx(0.02, 0.014, 0.004), strap, [-0.035, 0.0225, -0.005]),
    mesh(bx(0.02, 0.014, 0.004), strap, [0.035, 0.0225, -0.005]),
    mesh(bx(0.004, 0.014, 0.02), strap, [-0.043, 0.0225, -0.015]),
    mesh(bx(0.004, 0.014, 0.02), strap, [0.043, 0.0225, -0.015]),
  )
}
