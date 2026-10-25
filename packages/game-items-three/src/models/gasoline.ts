import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const gasoline: ItemModelBuilder = ({ mesh, cyl, G, plastic, paper }) => {
  const bottle = plastic(0xc9c6b8)
  const cap = plastic(0xa3322a)
  return G(
    mesh(cyl(0.045, 0.045, 0.19, 12), bottle, [0, 0.095, 0]),
    mesh(cyl(0.0455, 0.0455, 0.07, 12), paper(0xa3322a), [0, 0.095, 0]),
    mesh(cyl(0.014, 0.045, 0.04, 12), bottle, [0, 0.21, 0]),
    mesh(cyl(0.014, 0.014, 0.01, 8), bottle, [0, 0.235, 0]),
    mesh(cyl(0.018, 0.018, 0.02, 8), cap, [0, 0.25, 0]),
  )
}
