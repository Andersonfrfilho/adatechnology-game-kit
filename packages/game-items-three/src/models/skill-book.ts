import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const skillBook: ItemModelBuilder = ({ mesh, bx, G, paper, cloth }) => {
  const cover = cloth(0x6b3f26)
  const trim = paper(0xc9a45a)
  return G(
    mesh(bx(0.154, 0.224, 0.033), paper(0xe4dcc6), [0.0005, 0.115, 0]),
    mesh(bx(0.16, 0.23, 0.0034), cover, [0, 0.115, 0.0183]),
    mesh(bx(0.16, 0.23, 0.0034), cover, [0, 0.115, -0.0183]),
    mesh(bx(0.006, 0.23, 0.04), cover, [-0.077, 0.115, 0]),
    mesh(bx(0.008, 0.01, 0.04), trim, [-0.0775, 0.2, 0]),
    mesh(bx(0.008, 0.01, 0.04), trim, [-0.0775, 0.03, 0]),
    mesh(bx(0.09, 0.05, 0.0002), trim, [0.005, 0.17, 0.0201]),
    mesh(bx(0.06, 0.006, 0.0002), trim, [0.005, 0.06, 0.0201]),
  )
}
