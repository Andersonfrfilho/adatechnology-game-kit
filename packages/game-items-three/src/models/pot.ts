import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `pot`.
 */
export const pot: ItemModelBuilder = ({ mesh, cyl, bx, G, metal, plastic }) => {
  const potMesh = mesh(cyl(1.25, 1.25, 1.35, 16), metal(0xaaaaaa), [0, -0.075, 0])
  const lid = mesh(cyl(1.25, 1.25, 0.08, 16), metal(0xcccccc), [0, 0.64, 0])
  const knob = mesh(bx(0.2, 0.07, 0.2), plastic(0x111111), [0, 0.715, 0])
  return G(potMesh, lid, knob)
}
