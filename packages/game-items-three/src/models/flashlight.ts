import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["lanterna"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L159), ported as it is: same units, same parts, same order, same materials by tag.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `flashlight`.
 */
export const flashlight: ItemModelBuilder = ({ M, mesh, cyl, bx, torus, G, metal, plastic }) => G(mesh(cyl(.11, .11, .8, 14), metal(0x2a2c2e), [0, -.15, 0]), mesh(cyl(.19, .12, .28, 16), metal(0x3a3d40), [0, .37, 0]), mesh(cyl(.17, .17, .02, 16), M(0xfff1c0, "glass", { emissive: 0xffe08a, emissiveIntensity: .9 }), [0, .52, 0]), mesh(bx(.06, .1, .05), plastic(0xb5521f), [0, .05, .11]), ...[-.4, -.3, -.2].map(y => mesh(torus(.112, .012), plastic(0x1b1c1d), [0, y, 0], [Math.PI / 2, 0, 0])))
