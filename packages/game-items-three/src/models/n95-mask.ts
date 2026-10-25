import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `n95_mask`.
 */
export const n95Mask: ItemModelBuilder = ({ mesh, bx, extrude, G, cloth, metal, paper }) => {
  const white = cloth(0xf1f1ee)
  const strapMaterial = cloth(0xdcdcd6)
  const cup = mesh(extrude([[-0.5, 0.2], [-0.38, 0.53], [0.38, 0.53], [0.5, 0.2], [0.4, -0.42], [0, -0.53], [-0.4, -0.42]], 0.21, 0.02), white, [0, 0, -0.105])
  const fold = mesh(bx(0.9, 0.03, 0.01), paper(0xc9c9c2), [0, 0, 0.12])
  const noseClip = mesh(bx(0.5, 0.03, 0.01), metal(0x8e949a), [0, 0.5, 0.12])
  const strapTopLeft = mesh(bx(0.3, 0.04, 0.03), strapMaterial, [-0.6, 0.15, 0])
  const strapTopRight = mesh(bx(0.3, 0.04, 0.03), strapMaterial, [0.6, 0.15, 0])
  const strapLowLeft = mesh(bx(0.3, 0.04, 0.03), strapMaterial, [-0.6, -0.25, 0])
  const strapLowRight = mesh(bx(0.3, 0.04, 0.03), strapMaterial, [0.6, -0.25, 0])
  return G(cup, fold, noseClip, strapTopLeft, strapTopRight, strapLowLeft, strapLowRight)
}
