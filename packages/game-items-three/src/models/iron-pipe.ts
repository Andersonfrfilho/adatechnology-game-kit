import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `iron_pipe`.
 */
export const ironPipe: ItemModelBuilder = ({ mesh, cyl, G, metal }) => {
  const R = Math.PI / 2
  const rust = metal(0x7a4a2c)
  const collar = metal(0x4a4e53)
  const bore = metal(0x1c1d1f)
  return G(
    mesh(cyl(0.155, 0.155, 7.4, 8), metal(0x5b6066), [0, 0, 0], [0, 0, R]),
    mesh(cyl(0.177, 0.177, 0.6, 8), collar, [3.7, 0, 0], [0, 0, R]),
    mesh(cyl(0.177, 0.177, 0.6, 8), collar, [-3.7, 0, 0], [0, 0, R]),
    mesh(cyl(0.165, 0.165, 0.35, 8), rust, [-1.1, 0, 0], [0, 0, R]),
    mesh(cyl(0.165, 0.165, 0.35, 8), rust, [1.9, 0, 0], [0, 0, R]),
    mesh(cyl(0.11, 0.11, 0.02, 8), bore, [3.995, 0, 0], [0, 0, R]),
    mesh(cyl(0.11, 0.11, 0.02, 8), bore, [-3.995, 0, 0], [0, 0, R]),
  )
}
