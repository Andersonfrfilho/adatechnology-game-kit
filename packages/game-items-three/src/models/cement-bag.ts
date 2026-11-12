import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `cement_bag`.
 */
export const cementBag: ItemModelBuilder = ({ mesh, bx, G, paper, cloth }) => {
  return G(
    mesh(bx(4.6, 0.6, 3.0), paper(0xb9b4a3)),
    mesh(bx(4.0, 0.9155, 2.5), paper(0xc9c4b3), [0, -0.04775, 0]),
    mesh(bx(2.4, 0.1, 0.85), paper(0xe8e2d0), [0, 0.4555, 0.575]),
    mesh(bx(2.4, 0.1, 0.25), paper(0x2f5d8a), [0, 0.4555, 0]),
    mesh(bx(0.32, 0.3, 2.8), cloth(0x8c8672), [2.34, 0, 0]),
    mesh(bx(0.32, 0.3, 2.8), cloth(0x8c8672), [-2.34, 0, 0]),
  )
}
