import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["amoxicilina"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L152), ported as it is: same units, same parts, same order, same materials by tag.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `amoxicillin`.
 */
export const amoxicillin: ItemModelBuilder = ({ T, mesh, bx, G, metal, plastic, paper }) => G(mesh(bx(.8, .42, .24), paper(0xf0eee6)), mesh(bx(.81, .1, .25), plastic(0x4e7287), [0, .1, 0]), mesh(bx(.6, .04, .3), metal(0xb9bdc0), [.15, -.24, .25], [0, .3, 0]), ...[0, 1, 2, 3].map(k => mesh(new T.SphereGeometry(.05, 10, 8), plastic(0xd9a441), [-.05 + k * .14, -.21, .3], [0, 0, 0], [1, .6, 1])))
