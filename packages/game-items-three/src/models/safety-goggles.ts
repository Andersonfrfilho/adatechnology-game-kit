import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const safetyGoggles: ItemModelBuilder = ({ mesh, bx, cyl, G, plastic, glass, cloth }) => {
  const frame = plastic(0x2f4f6f)
  const lens = glass(0xcfe6f0, 0.45)
  const band = cloth(0x1f2326)
  const cup = (x: number) => [
    mesh(cyl(0.03, 0.03, 0.02, 10), frame, [x, 0.03, 0.027], [Math.PI / 2, 0, 0]),
    mesh(cyl(0.024, 0.024, 0.006, 10), lens, [x, 0.03, 0.037], [Math.PI / 2, 0, 0]),
  ]
  return G(
    ...cup(-0.04),
    ...cup(0.04),
    mesh(bx(0.03, 0.012, 0.02), frame, [0, 0.036, 0.027]),
    mesh(bx(0.006, 0.03, 0.05), band, [-0.077, 0.03, 0.0]),
    mesh(bx(0.006, 0.03, 0.05), band, [0.077, 0.03, 0.0]),
    mesh(bx(0.16, 0.03, 0.006), band, [0, 0.03, -0.037]),
  )
}
