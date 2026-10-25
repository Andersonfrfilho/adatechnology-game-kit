import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `raffia_sack`.
 */
export const raffiaSack: ItemModelBuilder = ({ mesh, bx, G, cloth }) => {
  return G(
    mesh(bx(3.98, 0.18, 2.94), cloth(0xd9cfa8)),
    mesh(bx(4.0, 0.2, 0.14), cloth(0xb8ad84), [0, 0, 1.43]),
    mesh(bx(4.0, 0.2, 0.14), cloth(0xb8ad84), [0, 0, -1.43]),
    mesh(bx(0.12, 0.2, 2.7), cloth(0x3b6ea5), [1.0, 0, 0]),
    mesh(bx(0.12, 0.2, 2.7), cloth(0x3b6ea5), [-1.0, 0, 0]),
  )
}
