import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["radio_portatil"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L160), ported as it is: same units, same parts, same order, same materials by tag.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `portable_radio`.
 */
export const portableRadio: ItemModelBuilder = ({ M, mesh, cyl, bx, torus, G, metal, plastic }) => { const g = G(mesh(bx(1.05, .62, .3), plastic(0x3a3d35)), mesh(cyl(.2, .2, .02, 18), plastic(0x1e1f1b), [-.24, -.04, .16], [Math.PI / 2, 0, 0]), mesh(bx(.36, .14, .02), M(0xd9a441, "glass", { emissive: 0x6a4a10, emissiveIntensity: .6 }), [.26, .1, .16]), mesh(cyl(.06, .06, .06, 12), plastic(0x8d8a80), [.18, -.15, .17], [Math.PI / 2, 0, 0]), mesh(cyl(.06, .06, .06, 12), plastic(0x8d8a80), [.36, -.15, .17], [Math.PI / 2, 0, 0]), mesh(torus(.24, .03, Math.PI), plastic(0x22251f), [0, .3, 0])); const a = mesh(cyl(.012, .02, .95, 6), metal(0xb9bdc0), [.4, .72, 0], [0, 0, -.35]); g.add(a); return g; }
