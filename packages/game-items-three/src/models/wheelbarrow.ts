import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const wheelbarrow: ItemModelBuilder = ({ mesh, cyl, bx, G, metal, plastic }) => {
  const tub = metal(0x2f5d3a)
  const frame = metal(0x3a3d40)
  const tire = plastic(0x1d1e20)
  const tilt = 0.42
  return G(
    mesh(bx(0.4, 0.02, 0.5), tub, [0, 0.38, 0.2]),
    mesh(bx(0.02, 0.29, 0.62), tub, [-0.255, 0.515, 0.2], [0, 0, tilt]),
    mesh(bx(0.02, 0.29, 0.62), tub, [0.255, 0.515, 0.2], [0, 0, -tilt]),
    mesh(bx(0.5, 0.29, 0.02), tub, [0, 0.515, 0.5], [0.5, 0, 0]),
    mesh(bx(0.5, 0.29, 0.02), tub, [0, 0.515, -0.1], [-0.5, 0, 0]),
    mesh(bx(0.03, 0.03, 1.3), frame, [-0.2, 0.33, -0.1]),
    mesh(bx(0.03, 0.03, 1.3), frame, [0.2, 0.33, -0.1]),
    mesh(cyl(0.02, 0.02, 0.3, 6), plastic(0x6b4a2f), [-0.2, 0.33, -0.6], [Math.PI / 2, 0, 0]),
    mesh(cyl(0.02, 0.02, 0.3, 6), plastic(0x6b4a2f), [0.2, 0.33, -0.6], [Math.PI / 2, 0, 0]),
    mesh(bx(0.03, 0.31, 0.03), frame, [-0.2, 0.155, -0.35]),
    mesh(bx(0.03, 0.31, 0.03), frame, [0.2, 0.155, -0.35]),
    mesh(bx(0.02, 0.15, 0.02), frame, [-0.05, 0.27, 0.55]),
    mesh(bx(0.02, 0.15, 0.02), frame, [0.05, 0.27, 0.55]),
    mesh(cyl(0.2, 0.2, 0.06, 12), tire, [0, 0.2, 0.55], [0, 0, Math.PI / 2]),
  )
}
