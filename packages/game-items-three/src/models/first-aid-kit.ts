import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["kit_ps"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L150), ported as it is: same units, same parts, same order, same materials by tag.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `first_aid_kit`.
 */
export const firstAidKit: ItemModelBuilder = ({ mesh, bx, torus, G, plastic }) => { const r = plastic(0xb23a2c); return G(mesh(bx(1.05, .72, .38), plastic(0xe6e3d8)), mesh(bx(1.07, .06, .4), plastic(0xbdb8aa), [0, 0, 0]), mesh(bx(.36, .1, .02), r, [0, .1, .2]), mesh(bx(.1, .36, .02), r, [0, .1, .2]), mesh(torus(.16, .035, Math.PI), plastic(0x55534c), [0, .36, 0])); }
