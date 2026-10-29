import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 */
export const diyMagazine: ItemModelBuilder = ({ mesh, bx, G, paper }) =>
  G(
    mesh(bx(0.21, 0.28, 0.0078), paper(0xe9e6dc), [0, 0.14, 0]),
    mesh(bx(0.21, 0.28, 0.0001), paper(0xd9a441), [0, 0.14, 0.0039]),
    mesh(bx(0.21, 0.28, 0.0001), paper(0xd9a441), [0, 0.14, -0.0039]),
    mesh(bx(0.19, 0.04, 0.0002), paper(0x2f3f52), [0, 0.255, 0.004]),
    mesh(bx(0.15, 0.13, 0.0002), paper(0x8a6a45), [0, 0.13, 0.004]),
    mesh(bx(0.19, 0.012, 0.0002), paper(0xa3322a), [0, 0.04, 0.004]),
    mesh(bx(0.003, 0.28, 0.0008), paper(0x1f2124), [-0.0975, 0.14, 0]),
  )
