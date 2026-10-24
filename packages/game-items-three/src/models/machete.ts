import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["facao"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L155), ported as it is: same units, same parts, same order, same materials by tag.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `machete`.
 */
export const machete: ItemModelBuilder = ({ mesh, cyl, bx, extrude, G, metal, wood }) => G(mesh(extrude([[0, 0], [1.25, .05], [1.4, .14], [1.3, .26], [0, .2]], .03), metal(0xa9adb0), [-.55, 0, 0]), mesh(bx(.45, .2, .1), wood(0x3b2a20), [-.78, .1, .015]), ...[-.9, -.68].map(x => mesh(cyl(.025, .025, .12, 8), metal(0xb8913a), [x, .1, .015], [Math.PI / 2, 0, 0])))
