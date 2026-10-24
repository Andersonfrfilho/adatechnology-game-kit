import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["walkie"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L166), ported as it is: same units, same parts, same order, same materials by tag.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `walkie_talkies`.
 */
export const walkieTalkies: ItemModelBuilder = ({ M, mesh, cyl, bx, G, plastic }) => G(mesh(bx(.42, .9, .2), plastic(0x2a2d27)), mesh(bx(.34, .3, .02), plastic(0x161814), [0, -.12, .11]), mesh(bx(.24, .12, .02), M(0x9fbf8a, "glass", { emissive: 0x2f4a22, emissiveIntensity: .7 }), [0, .22, .11]), mesh(cyl(.035, .045, .6, 8), plastic(0x1b1c1a), [.12, .72, 0]), mesh(cyl(.04, .04, .08, 10), plastic(0xb5521f), [-.12, .48, 0]), mesh(bx(.05, .2, .1), plastic(0x3a3d35), [-.23, .05, 0]))
