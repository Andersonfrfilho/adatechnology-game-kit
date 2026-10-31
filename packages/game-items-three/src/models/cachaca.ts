import { asLid } from '../opening'

import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["cachaca"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L149), ported as it is: same units, same parts, same order, same materials by tag.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `cachaca`.
 */
export const cachaca: ItemModelBuilder = ({ mesh, cyl, lathe, G, wood, paper, food, glass }) => G(mesh(lathe([[0, -.6], [.25, -.6], [.27, -.52], [.27, .1], [.2, .25], [.09, .35], [.09, .58], [0, .58]]), glass(0xc28a2a, .78)), asLid(mesh(cyl(.08, .07, .14, 10), wood(0x8a6a44), [0, .64, 0])), mesh(cyl(.275, .275, .34, 16), paper(0xe9e1cc), [0, -.25, 0]), mesh(cyl(.276, .276, .06, 16), food(0x7a2f1f), [0, -.15, 0]))
