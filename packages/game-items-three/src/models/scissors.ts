import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `scissors`.
 */
export const scissors: ItemModelBuilder = ({ mesh, bx, cyl, lathe, G, metal, plastic }) => {
  const steel = metal(0xb5b9be)
  const grip = plastic(0xb5321f)
  const ring = lathe([[1.1, -0.75], [1.9, -0.75], [1.9, 0.75], [1.1, 0.75], [1.1, -0.75]], 8)
  return G(
    mesh(ring, grip, [-7.1, 0, 1.6]),
    mesh(ring, grip, [-7.1, 0, -1.6]),
    mesh(bx(4.4, 0.6, 0.9), steel, [-3.4, 0.35, -0.8]),
    mesh(bx(4.4, 0.6, 0.9), steel, [-3.4, -0.35, 0.8]),
    mesh(bx(6, 0.6, 1.6), steel, [1.8, 0.35, 0.3]),
    mesh(bx(6, 0.6, 1.6), steel, [1.8, -0.35, -0.3]),
    mesh(bx(3, 0.6, 0.8), steel, [7.5, 0.35, 0.2]),
    mesh(bx(3, 0.6, 0.8), steel, [7.5, -0.35, -0.2]),
    mesh(cyl(0.5, 0.5, 1.5, 8), metal(0x6f7378), [-1, 0, 0]),
  )
}
