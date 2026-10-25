import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const charcoalBag: ItemModelBuilder = ({ mesh, bx, G, paper, plastic }) => {
  const sack = paper(0x6b5a45)
  return G(
    mesh(bx(0.3, 0.1, 0.34), sack, [0, 0.05, 0]),
    mesh(bx(0.26, 0.12, 0.03), sack, [0, 0.06, 0.185]),
    mesh(bx(0.26, 0.12, 0.03), sack, [0, 0.06, -0.185]),
    mesh(bx(0.24, 0.02, 0.3), sack, [0, 0.11, 0]),
    mesh(bx(0.2, 0.004, 0.16), plastic(0x24262a), [0, 0.118, 0]),
  )
}
