import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["tabua"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L168), ported as it is: same units, same parts, same order, same materials by tag.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `wooden_plank`.
 */
export const woodenPlank: ItemModelBuilder = ({ mesh, cyl, bx, G, metal, wood }) => { const g = G(); [0xa88459, 0x8e6c45, 0xb49268].forEach((c, k) => g.add(mesh(bx(1.5, .07, .26), wood(c), [0, -.15 + k * .12, (k - 1) * .05], [0, (k - 1) * .12, 0]))); const nm = metal(0x7d8186); [-.5, -.3, .4].forEach((x, k) => g.add(mesh(cyl(.012, .012, .18, 6), nm, [x, .18 + k * .01, .2], [0, 0, (k - 1) * .3]))); return g; }
