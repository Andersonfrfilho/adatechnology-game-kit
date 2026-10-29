import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const diesel: ItemModelBuilder = ({ mesh, cyl, G, plastic, paper }) => {
  const bottle = plastic(0xb89a3c)
  const cap = plastic(0x1c1d1f)
  return G(
    mesh(cyl(0.045, 0.045, 0.19, 12), bottle, [0, 0.095, 0]),
    mesh(cyl(0.0455, 0.0455, 0.07, 12), paper(0xd9d4c4), [0, 0.095, 0]),
    mesh(cyl(0.014, 0.045, 0.04, 12), bottle, [0, 0.21, 0]),
    mesh(cyl(0.014, 0.014, 0.01, 8), bottle, [0, 0.235, 0]),
    mesh(cyl(0.018, 0.018, 0.02, 8), cap, [0, 0.25, 0]),
  )
}
