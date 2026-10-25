import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `wire_roll`.
 */
export const wireRoll: ItemModelBuilder = ({ mesh, lathe, cyl, G, metal, paper }) => {
  const coil = lathe([[0.32, -0.25], [0.66, -0.25], [0.7, -0.2], [0.7, 0.2], [0.66, 0.25], [0.32, 0.25], [0.32, -0.25]], 12)
  const tube = lathe([[0.26, -0.25], [0.32, -0.25], [0.32, 0.25], [0.26, 0.25], [0.26, -0.25]], 12)
    return G(
    mesh(coil, metal(0x8d9096)),
    mesh(tube, paper(0x9a7b4f)),
    mesh(cyl(0.702, 0.702, 0.05, 12), metal(0x5c6065), [0, -0.1, 0]),
    mesh(cyl(0.702, 0.702, 0.05, 12), metal(0x5c6065), [0, 0.1, 0]),
  )
}
