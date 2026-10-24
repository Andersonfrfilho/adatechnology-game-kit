import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `iron_pipe`.
 */
export const ironPipe: ItemModelBuilder = ({ mesh, cyl, G, metal, cloth }) => {
  const pipe = mesh(cyl(0.175, 0.175, 8.0, 16), metal(0x555555), [0, 0, 0], [0, 0, Math.PI / 2])
  const grip = mesh(cyl(0.177, 0.177, 1.8, 16), cloth(0x222222), [-2.8, 0, 0], [0, 0, Math.PI / 2])
  return G(pipe, grip)
}
