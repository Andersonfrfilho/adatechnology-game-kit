import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const portableGenerator: ItemModelBuilder = ({ M, mesh, cyl, bx, G, metal, plastic }) => {
  const quarter = Math.PI / 2
  const frame = metal(0x3a3c3e)
  const group = G(
    mesh(bx(0.5, 0.02, 0.02), frame, [0, 0.01, 0.205]),
    mesh(bx(0.5, 0.02, 0.02), frame, [0, 0.01, -0.205]),
    mesh(bx(0.02, 0.02, 0.43), frame, [0.24, 0.01, 0]),
    mesh(bx(0.02, 0.02, 0.43), frame, [-0.24, 0.01, 0]),
    mesh(bx(0.5, 0.02, 0.02), frame, [0, 0.41, 0.205]),
    mesh(bx(0.5, 0.02, 0.02), frame, [0, 0.41, -0.205]),
    mesh(bx(0.02, 0.02, 0.43), frame, [0.24, 0.41, 0]),
    mesh(bx(0.02, 0.02, 0.43), frame, [-0.24, 0.41, 0]),
    mesh(bx(0.2, 0.2, 0.26), metal(0x6e7173), [-0.12, 0.13, 0]),
    mesh(cyl(0.11, 0.11, 0.18, 14), metal(0x3f5a73), [0.14, 0.15, 0], [0, 0, quarter]),
    mesh(bx(0.34, 0.1, 0.28), plastic(0x9c2f23), [0, 0.35, 0]),
    mesh(cyl(0.025, 0.025, 0.02, 8), plastic(0x1c1c1c), [-0.1, 0.41, 0]),
    mesh(bx(0.2, 0.12, 0.01), plastic(0x222426), [0.13, 0.2, 0.21]),
    mesh(bx(0.04, 0.04, 0.0045), M(0x777a7d, 'plastic'), [0.09, 0.2, 0.2162]),
    mesh(bx(0.04, 0.04, 0.0045), M(0x777a7d, 'plastic'), [0.17, 0.2, 0.2162]),
    mesh(cyl(0.035, 0.035, 0.16, 10), metal(0x5b4a3c), [-0.12, 0.1, -0.17], [0, 0, quarter]),
  )
  for (const [x, z] of [[-0.24, -0.205], [0.24, -0.205], [-0.24, 0.205], [0.24, 0.205]] as const) group.add(mesh(bx(0.02, 0.4, 0.02), frame, [x, 0.21, z]))
  return group
}
