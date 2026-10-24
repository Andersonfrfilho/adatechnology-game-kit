import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["atadura"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L151), ported as it is: same units, same parts, same order, same materials by tag.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `bandage`.
 */
export const bandage: ItemModelBuilder = ({ mesh, cyl, bx, G, cloth }) => { const c = cloth(0xece5d2); return G(mesh(cyl(.34, .34, .38, 18), c, [0, 0, 0], [Math.PI / 2, 0, 0]), mesh(cyl(.1, .1, .4, 12), cloth(0x8a8577), [0, 0, 0], [Math.PI / 2, 0, 0]), mesh(bx(.36, .02, .36), c, [.2, -.33, .05], [0, 0, -.25]), mesh(bx(.3, .02, .36), c, [.5, -.4, .05], [0, 0, -.05])); }
