import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const laptop: ItemModelBuilder = ({ mesh, cyl, bx, G, metal, plastic }) =>
  G(
    mesh(bx(0.36, 0.012, 0.25), metal(0x8d9094), [0, 0.006, 0]),
    mesh(bx(0.358, 0.012, 0.248), metal(0x2c2f33), [0, 0.019, 0]),
    mesh(cyl(0.006, 0.006, 0.2, 8), plastic(0x1c1c1c), [0, 0.0125, -0.12], [0, 0, Math.PI / 2]),
    mesh(bx(0.05, 0.0002, 0.03), metal(0xb4b7ba), [0, 0.0251, 0]),
  )
