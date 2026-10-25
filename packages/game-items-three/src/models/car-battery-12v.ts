import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const carBattery12V: ItemModelBuilder = ({ mesh, cyl, bx, G, metal, plastic, paper }) => {
  const shell = plastic(0x23262a)
  return G(
    mesh(bx(0.24, 0.15, 0.17), shell, [0, 0.075, 0]),
    mesh(bx(0.2, 0.01, 0.04), plastic(0x3a3e44), [0, 0.155, -0.04]),
    mesh(bx(0.18, 0.07, 0.005), paper(0xcfc9b4), [0, 0.07, 0.085]),
    mesh(cyl(0.014, 0.014, 0.04, 8), metal(0x8d9096), [-0.08, 0.17, 0.05]),
    mesh(cyl(0.014, 0.014, 0.04, 8), metal(0x8d9096), [0.08, 0.17, 0.05]),
    mesh(bx(0.1, 0.025, 0.02), shell, [0, 0.1625, -0.07]),
  )
}
