import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `duct_tape`.
 */
export const ductTape: ItemModelBuilder = ({ mesh, bx, lathe, G, metal, paper }) => {
  const ring = (inner: number, outer: number, half: number) => lathe([[inner, -half], [outer, -half], [outer, half], [inner, half], [inner, -half]], 16)
  return G(
    mesh(ring(2.8, 5, 2.5), metal(0x8b8f93)),
    mesh(ring(2.4, 2.8, 2.3), paper(0xa88a5c)),
    mesh(bx(0.2, 4.6, 2.4), metal(0xa4a8ac), [4.9, 0, 0]),
  )
}
