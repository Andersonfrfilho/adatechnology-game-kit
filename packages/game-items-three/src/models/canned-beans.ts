import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["feijao_lata"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L145), ported as it is: same units, same parts, same order, same materials by tag.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `canned_beans`.
 */
export const cannedBeans: ItemModelBuilder = ({ mesh, cyl, torus, G, metal, paper, food }) => { const m = metal(0x8d9096); return G(mesh(cyl(.32, .32, .52), m), mesh(cyl(.326, .326, .34, 14), food(0x9b3a24)), mesh(cyl(.33, .33, .06), paper(0xe2c36a), [0, .02, 0]), mesh(torus(.31, .025), m, [0, .26, 0], [Math.PI / 2, 0, 0]), mesh(torus(.31, .025), m, [0, -.26, 0], [Math.PI / 2, 0, 0])); }
