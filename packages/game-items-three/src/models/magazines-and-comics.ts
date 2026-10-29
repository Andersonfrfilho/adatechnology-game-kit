import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const magazinesAndComics: ItemModelBuilder = ({ mesh, bx, G, paper }) =>
  G(
    mesh(bx(0.17, 0.26, 0.0092), paper(0xe4dcc6), [0, 0.13, 0]),
    mesh(bx(0.17, 0.26, 0.0002), paper(0xb23a2e), [0, 0.13, 0.0048]),
    mesh(bx(0.17, 0.26, 0.0002), paper(0xb23a2e), [0, 0.13, -0.0048]),
    mesh(bx(0.15, 0.04, 0.0002), paper(0xf0d36a), [0, 0.235, 0.005]),
    mesh(bx(0.14, 0.14, 0.0002), paper(0x3b6ea0), [0, 0.12, 0.005]),
    mesh(bx(0.07, 0.07, 0.0002), paper(0xf0d36a), [-0.03, 0.12, 0.0051]),
  )
