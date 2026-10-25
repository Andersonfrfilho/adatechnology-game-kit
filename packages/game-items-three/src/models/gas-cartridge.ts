import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const gasCartridge: ItemModelBuilder = ({ mesh, cyl, G, metal, paper }) => {
  const can = metal(0x3b5f8a)
  return G(
    mesh(cyl(0.055, 0.055, 0.12, 12), can, [0, 0.06, 0]),
    mesh(cyl(0.0555, 0.0555, 0.04, 12), paper(0xd8d2c0), [0, 0.06, 0]),
    mesh(cyl(0.025, 0.055, 0.03, 12), can, [0, 0.135, 0]),
    mesh(cyl(0.02, 0.02, 0.015, 8), metal(0x8d9096), [0, 0.1575, 0]),
  )
}
