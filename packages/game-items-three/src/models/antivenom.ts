import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `antivenom`.
 */
export const antivenom: ItemModelBuilder = ({ mesh, bx, G, plastic, metal, paper }) => {
  const body = mesh(bx(1.5, 0.5, 0.5), plastic(0xe8ecef), [0, -0.2, 0])
  const lid = mesh(bx(1.5, 0.25, 0.5), plastic(0xc8352b), [0, 0.175, 0])
  const postLeft = mesh(bx(0.06, 0.15, 0.08), plastic(0x8f2620), [-0.25, 0.375, 0])
  const postRight = mesh(bx(0.06, 0.15, 0.08), plastic(0x8f2620), [0.25, 0.375, 0])
  const handle = mesh(bx(0.56, 0.05, 0.08), plastic(0x8f2620), [0, 0.425, 0])
  const latchLeft = mesh(bx(0.12, 0.22, 0.504), metal(0xb7bcc2), [-0.5, 0.05, 0])
  const latchRight = mesh(bx(0.12, 0.22, 0.504), metal(0xb7bcc2), [0.5, 0.05, 0])
  const label = mesh(bx(0.34, 0.3, 0.01), paper(0xfdfdfb), [0, -0.2, 0.2455])
  const crossUpright = mesh(bx(0.07, 0.22, 0.01), paper(0xc8352b), [0, -0.2, 0.2465])
  const crossArm = mesh(bx(0.22, 0.07, 0.01), paper(0xc8352b), [0, -0.2, 0.2466])
  return G(body, lid, postLeft, postRight, handle, latchLeft, latchRight, label, crossUpright, crossArm)
}
