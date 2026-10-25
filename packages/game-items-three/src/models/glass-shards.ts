import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `glass_shards`.
 */
export const glassShards: ItemModelBuilder = ({ T, mesh, extrude, G, glass }) => {
  const R = Math.PI / 2
  const pane = glass(0xbfe3df, 0.55)
  const deep = glass(0x7fb5b0, 0.7)
  const base = extrude([[-0.6, -0.1], [0.45, -0.5], [0.6, 0.2], [-0.1, 0.5]], 0.04, 0.002)
  const chip = extrude([[0, 0], [0.25, 0.05], [0.1, 0.22]], 0.03, 0.002)
  return G(
    mesh(base, pane, [0, 0, 0], [R, 0, 0]),
    mesh(chip, deep, [0.2, 0, -0.35], [R, 0, 0.4]),
    mesh(new T.ConeGeometry(0.14, 0.46, 3), pane, [-0.2, 0.23, 0.1], [0, 0.3, 0.12]),
    mesh(new T.ConeGeometry(0.1, 0.34, 3), deep, [0.25, 0.17, -0.1], [0.15, 0, -0.2]),
    mesh(new T.ConeGeometry(0.08, 0.26, 3), pane, [0.05, 0.13, 0.3], [-0.2, 0.5, 0.15]),
  )
}
