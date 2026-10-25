import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const flipFlops: ItemModelBuilder = ({ mesh, bx, cyl, G, plastic }) => {
  const sole = plastic(0x365d73)
  const strap = plastic(0x1f2326)
  const sandal = (z: number) => [
    mesh(cyl(0.5, 0.5, 0.02, 12), sole, [0.06, 0.01, z], [0, 0, 0], [0.17, 1, 0.105]),
    mesh(cyl(0.5, 0.5, 0.02, 12), sole, [-0.075, 0.01, z], [0, 0, 0], [0.14, 1, 0.09]),
    mesh(bx(0.06, 0.02, 0.07), sole, [-0.01, 0.01, z]),
    mesh(cyl(0.006, 0.006, 0.02, 6), strap, [0.1, 0.02, z]),
    mesh(bx(0.1, 0.008, 0.012), strap, [0.055, 0.024, z + 0.0225], [0, 0.4636, 0]),
    mesh(bx(0.1, 0.008, 0.012), strap, [0.055, 0.024, z - 0.0225], [0, -0.4636, 0]),
  ]
  return G(...sandal(-0.0625), ...sandal(0.0625))
}
