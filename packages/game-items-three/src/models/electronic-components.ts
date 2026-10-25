import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `electronic_components`.
 */
export const electronicComponents: ItemModelBuilder = ({ mesh, bx, cyl, G, plastic, metal }) => {
  const R = Math.PI / 2
  const chip = plastic(0x18191b)
  const gold = metal(0xb8913a)
  const silver = metal(0xb4b8bb)
  return G(
    mesh(bx(1.0, 0.04, 0.8), plastic(0x2c6b3a), [0, -0.08, 0]),
    mesh(bx(0.22, 0.06, 0.14), chip, [-0.1, -0.03, -0.1]),
    mesh(bx(0.2, 0.02, 0.19), silver, [-0.1, -0.05, -0.1]),
    mesh(bx(0.3, 0.06, 0.18), chip, [0.2, -0.03, 0.2]),
    mesh(bx(0.28, 0.02, 0.27), silver, [0.2, -0.05, 0.2]),
    mesh(cyl(0.05, 0.05, 0.16, 8), plastic(0x2f4f8f), [0.35, 0.02, -0.25]),
    mesh(cyl(0.04, 0.04, 0.14, 8), plastic(0x8f3a2f), [0.2, 0.01, -0.3]),
    mesh(cyl(0.025, 0.025, 0.14, 8), plastic(0xc9a56b), [-0.3, -0.035, 0.2], [0, 0, R]),
    mesh(cyl(0.027, 0.027, 0.02, 6), plastic(0x8f3a2f), [-0.34, -0.035, 0.2], [0, 0, R]),
    mesh(cyl(0.027, 0.027, 0.02, 6), plastic(0x2f4f8f), [-0.26, -0.035, 0.2], [0, 0, R]),
    mesh(bx(0.3, 0.05, 0.06), chip, [-0.3, -0.035, 0.33]),
    ...[-0.4, -0.35, -0.3, -0.25, -0.2].map((x) => mesh(bx(0.03, 0.12, 0.03), gold, [x, 0, 0.33])),
    mesh(bx(0.14, 0.1, 0.16), silver, [0.43, -0.01, 0]),
  )
}
