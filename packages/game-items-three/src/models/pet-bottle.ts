import type { ItemModelBuilder } from './registry'

/**
 * Authored in the kit (no team model delivered); replace when the items team delivers one.
 * It draws in the units of the builder; `data/models.json` gives the scale to metres of the item `pet_bottle`.
 */
export const petBottle: ItemModelBuilder = ({ M, mesh, lathe, cyl, G, plastic, paper }) => {
  const body = lathe([[0, -1.65], [0.46, -1.65], [0.527, -1.5], [0.527, 0.55], [0.45, 0.85], [0.2, 1.2], [0.19, 1.37]], 12)
  return G(
    mesh(body, M(0xcfeaf2, 'plastic', { roughness: 0.3, transparent: true, opacity: 0.65 })),
    mesh(cyl(0.53, 0.53, 1.2, 12), paper(0xcc2222), [0, -0.5, 0]),
    mesh(cyl(0.215, 0.215, 0.3, 12), plastic(0x1565c0), [0, 1.5, 0]),
    mesh(cyl(0.22, 0.22, 0.04, 12), plastic(0xcfeaf2), [0, 1.33, 0]),
  )
}
