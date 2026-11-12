import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `splint`.
 */
export const splint: ItemModelBuilder = ({ mesh, bx, extrude, G, plastic, metal }) => {
  const foam = mesh(extrude([[-2.285, -0.495], [2.285, -0.495], [2.285, 0.495], [-2.285, 0.495]], 0.01, 0.015), plastic(0xee6611), [0, 0, -0.015])
  const core = mesh(bx(4.2, 0.5, 0.03), metal(0x2070b0), [0, 0, 0.0355])
  const strapLeft = mesh(bx(0.35, 1.1, 0.08), plastic(0x3a3f45), [-1.4, 0, -0.01])
  const strapRight = mesh(bx(0.35, 1.1, 0.08), plastic(0x3a3f45), [1.4, 0, -0.01])
  return G(foam, core, strapLeft, strapRight)
}
