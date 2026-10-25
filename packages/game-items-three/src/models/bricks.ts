import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `bricks`.
 */
export const bricks: ItemModelBuilder = ({ mesh, bx, G, M }) => {
  const brickMat = M(0xb5452b, 'wood', { roughness: 0.95 })
  const stack = mesh(bx(1.9, 1.8, 2.9), brickMat)
  const line = mesh(bx(1.902, 0.05, 2.902), M(0x8a7060, 'wood', { roughness: 0.95 }), [0, 0, 0])
  return G(stack, line)
}
