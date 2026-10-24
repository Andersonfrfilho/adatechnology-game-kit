import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["martelo"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L154), ported as it is: same units, same parts, same order, same materials by tag.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `hammer`.
 */
export const hammer: ItemModelBuilder = ({ T, mesh, cyl, bx, G, metal, wood, plastic }) => G(mesh(cyl(.05, .065, 1.1, 10), wood(0x8a643c), [0, -.15, 0]), mesh(cyl(.07, .07, .3, 10), plastic(0x22251f), [0, -.6, 0]), mesh(bx(.28, .15, .15), metal(0x55595d), [.05, .45, 0]), mesh(cyl(.08, .08, .1, 12), metal(0x55595d), [.22, .45, 0], [0, 0, Math.PI / 2]), mesh(new T.ConeGeometry(.06, .3, 6), metal(0x55595d), [-.22, .5, .035], [0, 0, 1.9]), mesh(new T.ConeGeometry(.06, .3, 6), metal(0x55595d), [-.22, .5, -.035], [0, 0, 1.9]))
