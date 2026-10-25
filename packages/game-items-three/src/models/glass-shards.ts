import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `glass_shards`.
 */
export const glassShards: ItemModelBuilder = ({ mesh, bx, G, glass }) => {
  const shard1 = mesh(bx(1.2, 0.5, 1.0), glass(0x88ccaa, 0.75))
  const shard2 = mesh(bx(0.6, 0.45, 0.5), glass(0x88ccaa, 0.75), [0.2, 0, -0.2])
  return G(shard1, shard2)
}
