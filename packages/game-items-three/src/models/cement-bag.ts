import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `cement_bag`.
 */
export const cementBag: ItemModelBuilder = ({ mesh, bx, G, paper, cloth }) => {
  return G(
    mesh(bx(5.0, 0.7, 3.0), paper(0xb9b4a3)),
    mesh(bx(4.5, 1.0, 2.6), paper(0xc9c4b3)),
    mesh(bx(2.4, 0.01, 1.5), paper(0xe8e2d0), [0, 0.505, 0]),
    mesh(bx(2.4, 0.011, 0.25), paper(0x2f5d8a), [0, 0.5055, 0]),
    mesh(bx(0.12, 0.5, 2.8), cloth(0x8c8672), [2.44, 0, 0]),
    mesh(bx(0.12, 0.5, 2.8), cloth(0x8c8672), [-2.44, 0, 0]),
  )
}
