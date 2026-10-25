import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `binoculars`.
 */
export const binoculars: ItemModelBuilder = ({ mesh, bx, cyl, G, M, plastic, metal }) => {
  const shell = plastic(0x2a2d30)
  const trim = metal(0x6a6e73)
  const lens = M(0x6a8fa3, 'glass', { metalness: 0.2, roughness: 0.2 })
  const barrel = (x: number) => [
    mesh(cyl(3.8, 3.8, 8, 12), shell, [x, -0.5, 0]),
    mesh(cyl(3, 3, 3.5, 12), trim, [x, -5.75, 0]),
    mesh(cyl(6, 4.6, 4, 12), shell, [x, 5.5, 0], [0, 0, 0], [0.8, 1, 1]),
    mesh(cyl(5.4, 5.4, 0.2, 8), lens, [x, 7.4, 0], [0, 0, 0], [0.8, 1, 1]),
  ]
  return G(...barrel(-4.2), ...barrel(4.2), mesh(bx(2.4, 6, 3), trim), mesh(cyl(1.3, 1.3, 3, 8), metal(0x3c3f43), [0, 0.5, 0]))
}
