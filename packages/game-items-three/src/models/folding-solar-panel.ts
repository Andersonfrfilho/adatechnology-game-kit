import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const foldingSolarPanel: ItemModelBuilder = ({ mesh, cyl, bx, G, cloth, glass, metal, plastic }) => {
  const group = G(
    mesh(bx(0.396, 0.296, 0.04), cloth(0x30343a), [0, 0.15, 0]),
    mesh(bx(0.38, 0.28, 0.004), glass(0x1d3557, 0.95), [0, 0.15, 0.023]),
    mesh(bx(0.15, 0.1, 0.01), cloth(0x252a2f), [0, 0.12, -0.02]),
    mesh(bx(0.002, 0.28, 0.0006), plastic(0x8d9aa8), [0, 0.15, 0.0253]),
    mesh(bx(0.002, 0.28, 0.0006), plastic(0x8d9aa8), [-0.095, 0.15, 0.0253]),
    mesh(bx(0.002, 0.28, 0.0006), plastic(0x8d9aa8), [0.095, 0.15, 0.0253]),
  )
  for (const [x, y] of [[-0.18, 0.03], [0.18, 0.03], [-0.18, 0.27], [0.18, 0.27]] as const) group.add(mesh(cyl(0.008, 0.008, 0.002, 6), metal(0xb4b7ba), [x, y, 0.024], [Math.PI / 2, 0, 0]))
  return group
}
