import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `medical_tape`.
 */
export const medicalTape: ItemModelBuilder = ({ mesh, cyl, lathe, G, cloth, plastic }) => {
  const roll = mesh(lathe([[0.12, -0.125], [0.248, -0.125], [0.248, 0.125], [0.12, 0.125]], 16), cloth(0xe9e6dc))
  const stripe = mesh(cyl(0.25, 0.25, 0.08, 16), cloth(0x3a78a8), [0, 0, 0])
  const core = mesh(lathe([[0.1, -0.125], [0.12, -0.125], [0.12, 0.125], [0.1, 0.125]], 16), plastic(0xffffff))
  const coreWall = mesh(lathe([[0.1, -0.125], [0.1, 0.125]], 16), plastic(0xf2f2f2))
  return G(roll, stripe, core, coreWall)
}
