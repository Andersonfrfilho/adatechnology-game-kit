import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["pilha_aa"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L167), ported as it is: same units, same parts, same order, same materials by tag.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `batteries`.
 */
export const batteries: ItemModelBuilder = ({ mesh, cyl, G, metal }) => { const g = G(); [-.2, .2].forEach((x, k) => g.add(mesh(cyl(.17, .17, .95, 16), metal(k ? 0xb5521f : 0x2a2c2e), [x, 0, 0]), mesh(cyl(.172, .172, .3, 16), metal(0xc9a227), [x, .33, 0]), mesh(cyl(.06, .06, .06, 10), metal(0xb9bdc0), [x, .5, 0]))); return g; }
