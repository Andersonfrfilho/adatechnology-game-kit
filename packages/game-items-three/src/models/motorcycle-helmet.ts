import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["capacete_moto"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L163), ported as it is: same units, same parts, same order, same materials by tag.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `motorcycle_helmet`.
 */
export const motorcycleHelmet: ItemModelBuilder = ({ T, M, mesh, cyl, bx, G, plastic }) => G(mesh(new T.SphereGeometry(.55, 18, 12), plastic(0x2b2f3a), [0, 0, 0], [0, 0, 0], [1, .95, 1.08]), mesh(new T.SphereGeometry(.56, 18, 10, -0.9, 1.8, 1.05, .75), M(0x14171c, "glass", { roughness: .15, metalness: .4 }), [0, .02, .02], [0, 0, 0], [1, .95, 1.08]), mesh(bx(.2, .12, .02), plastic(0xe0773f), [.42, .2, .22], [0, .95, 0]), mesh(cyl(.5, .55, .12, 18), plastic(0x1d2028), [0, -.5, 0]))
