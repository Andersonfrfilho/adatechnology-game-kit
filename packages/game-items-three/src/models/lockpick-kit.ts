import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `lockpick_kit`.
 */
export const lockpickKit: ItemModelBuilder = ({ mesh, bx, cyl, G, metal, cloth }) => {
  const leather = cloth(0x5b3d28)
  const pick = metal(0xaeb2b7)
  return G(
    mesh(bx(10, 6, 1.7), leather, [0, -0.5, 0]),
    mesh(bx(10, 3.2, 2), cloth(0x6b4830), [0, 0.9, 0]),
    mesh(cyl(0.45, 0.45, 0.2, 8), metal(0xb08a3c), [0, -0.7, 0.9], [Math.PI / 2, 0, 0]),
    mesh(bx(0.3, 2.2, 0.3), pick, [-2.5, 2.4, 0]),
    mesh(bx(0.3, 2.2, 0.3), pick, [0, 2.4, 0]),
    mesh(bx(0.3, 2.2, 0.3), pick, [2.5, 2.4, 0]),
  )
}
