import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["galao"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L165), ported as it is: same units, same parts, same order, same materials by tag.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `fuel_jerrycan`.
 */
export const fuelJerrycan: ItemModelBuilder = ({ mesh, cyl, bx, G, plastic }) => G(mesh(bx(.85, 1, .42), plastic(0xa3322a)), mesh(bx(.6, .1, .3), plastic(0x7e2620), [0, .45, 0]), mesh(bx(.36, .2, .1), plastic(0xa3322a), [-.12, .62, 0]), mesh(cyl(.05, .07, .35, 10), plastic(0xd9a441), [.3, .66, 0], [0, 0, -.6]), mesh(bx(.6, .5, .02), plastic(0x8a2a22), [0, -.1, .22]))
