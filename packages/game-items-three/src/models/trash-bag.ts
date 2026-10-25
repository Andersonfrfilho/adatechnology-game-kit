import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const trashBag: ItemModelBuilder = ({ mesh, bx, G, plastic }) => {
  const film = plastic(0x1c1d1f)
  return G(
    mesh(bx(0.2, 0.02, 0.2), film, [-0.025, 0.01, 0]),
    mesh(bx(0.2, 0.005, 0.02), film, [-0.025, 0.0225, 0]),
    mesh(bx(0.05, 0.012, 0.08), film, [0.1, 0.006, 0]),
    mesh(bx(0.03, 0.025, 0.04), film, [0.11, 0.0125, 0]),
  )
}
