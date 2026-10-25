import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `tactical_knife`.
 */
export const tacticalKnife: ItemModelBuilder = ({ mesh, bx, cyl, extrude, G, metal, plastic }) => {
  const R = Math.PI / 2
  const blade = extrude([[-1.3, 0.05], [-0.9, -0.225], [0.15, -0.225], [0.15, 0.225], [-0.7, 0.225], [-1.05, 0.15]], 0.05, 0.002)
  const grip = plastic(0x1b1c1d)
  const bolt = metal(0x8d9095)
  return G(
    mesh(blade, metal(0x3a3d40), [0, 0.025, 0], [R, 0, 0]),
    mesh(bx(0.1, 0.26, 0.42), metal(0x55595d), [0.2, 0, 0]),
    mesh(bx(0.4, 0.27, 0.32), grip, [0.45, 0, 0]),
    mesh(bx(0.4, 0.23, 0.3), plastic(0x2a2c2e), [0.85, 0, 0]),
    mesh(bx(0.25, 0.27, 0.34), grip, [1.175, 0, 0]),
    mesh(cyl(0.04, 0.04, 0.282, 8), bolt, [0.4, 0, 0]),
    mesh(cyl(0.04, 0.04, 0.282, 8), bolt, [1.15, 0, 0]),
  )
}
