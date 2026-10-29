import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `gas_torch`.
 */
export const gasTorch: ItemModelBuilder = ({ mesh, cyl, G, metal, plastic }) => {
  const brass = metal(0xa88a3c)
  const alongX = [0, 0, Math.PI / 2] as const
  return G(
    mesh(cyl(5, 5, 22, 12), metal(0xe3b82a), [0, -10, 0]),
    mesh(cyl(7.5, 7.5, 1.5, 16), metal(0x3c3f43), [0, -20.25, 0]),
    mesh(cyl(2.2, 5, 2.5, 12), metal(0xe3b82a), [0, 2.25, 0]),
    mesh(cyl(2.4, 2.4, 3, 8), brass, [0, 5, 0]),
    mesh(cyl(1, 1, 5, 8), plastic(0x1f2022), [4.5, 5, 0], alongX),
    mesh(cyl(1.6, 1.6, 1.2, 8), plastic(0xb5321f), [7, 5, 0], alongX),
    mesh(cyl(1.4, 1.4, 12, 8), brass, [0, 12.5, 0]),
    mesh(cyl(2.8, 1.4, 2.5, 8), metal(0x55595d), [0, 19.75, 0]),
  )
}
