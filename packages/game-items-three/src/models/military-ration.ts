import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["racao_militar"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L148), ported as it is: same units, same parts, same order, same materials by tag.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `military_ration`.
 */
export const militaryRation: ItemModelBuilder = ({ mesh, bx, G, plastic, paper }) => G(mesh(bx(.75, 1, .22), plastic(0x5a6146)), mesh(bx(.77, .1, .23), plastic(0x474d37), [0, .48, 0]), mesh(bx(.5, .14, .01), paper(0x22251f), [0, .18, .115]), mesh(bx(.36, .06, .01), paper(0x22251f), [0, -.02, .115]))
