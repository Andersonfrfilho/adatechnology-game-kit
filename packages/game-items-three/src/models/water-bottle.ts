import { asLid } from '../opening'

import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["agua_500"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L146), ported as it is: same units, same parts, same order, same materials by tag.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `water_bottle`.
 */
export const waterBottle: ItemModelBuilder = ({ mesh, cyl, lathe, G, plastic, paper, glass }) => G(mesh(lathe([[0, -.6], [.2, -.6], [.22, -.5], [.22, .2], [.19, .32], [.09, .45], [.08, .55], [0, .55]]), glass(0x8fc3dc, .55)), asLid(mesh(cyl(.085, .085, .1, 12), plastic(0x2c5d8a), [0, .6, 0])), mesh(cyl(.225, .225, .22, 16), paper(0xe9ecef), [0, -.15, 0]), mesh(cyl(.226, .226, .05, 16), plastic(0x3a78a8), [0, -.12, 0]))
