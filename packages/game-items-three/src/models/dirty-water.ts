import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `dirty_water`.
 */
export const dirtyWater: ItemModelBuilder = ({ mesh, cyl, lathe, G, plastic, paper, glass, food }) => {
  const bottle = mesh(lathe([[0, -0.915], [0.28, -0.915], [0.33, -0.86], [0.33, 0.28], [0.28, 0.5], [0.18, 0.64], [0.17, 0.72], [0, 0.72]], 12), glass(0xb9c4b8, 0.45))
  const murk = mesh(lathe([[0, -0.89], [0.27, -0.89], [0.315, -0.84], [0.315, 0.1], [0, 0.1]], 12), food(0x6b5a34))
  const sediment = mesh(cyl(0.31, 0.27, 0.12, 8), food(0x4a3d22), [0, -0.82, 0])
  const label = mesh(cyl(0.332, 0.332, 0.22, 12), paper(0xcfc9b4), [0, 0.38, 0])
  const cap = mesh(cyl(0.19, 0.19, 0.2, 8), plastic(0x5a6068), [0, 0.815, 0])
  return G(bottle, murk, sediment, label, cap)
}
