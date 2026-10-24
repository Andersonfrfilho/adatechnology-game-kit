import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["machado"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L156), ported as it is: same units, same parts, same order, same materials by tag.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `axe`.
 */
export const axe: ItemModelBuilder = ({ M, mesh, cyl, bx, extrude, G, metal, wood }) => G(mesh(cyl(.05, .06, 1.5, 10), wood(0x9a7448), [0, -.1, 0]), mesh(extrude([[0, 0], [.42, -.16], [.5, .05], [.48, .3], [.4, .42], [0, .22]], .07), metal(0x6c7075), [.02, .38, -.05]), mesh(bx(.12, .26, .14), metal(0x4a4d50), [0, .5, 0]), mesh(bx(.1, .2, .08), M(0x9b2a1f, "plastic"), [0, .55, 0]))
