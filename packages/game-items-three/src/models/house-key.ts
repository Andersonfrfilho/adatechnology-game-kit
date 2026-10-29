import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["chave_casa"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L161), ported as it is: same units, same parts, same order, same materials by tag.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `house_key`.
 */
export const houseKey: ItemModelBuilder = ({ mesh, bx, torus, extrude, G, metal, plastic }) => { const b = metal(0xb8913a); return G(mesh(torus(.22, .04), metal(0x9a9da0), [-.55, .1, 0]), mesh(extrude([[0, -.2], [.25, -.22], [.3, -.1], [.3, .1], [.25, .22], [0, .2]], .05), b, [-.38, .02, -.025]), mesh(extrude([[0, 0], [.75, 0], [.75, -.08], [.66, -.08], [.66, -.14], [.56, -.08], [.46, -.14], [.4, -.08], [0, -.08]], .035), b, [-.1, .06, -.017]), mesh(bx(.24, .34, .03), plastic(0xb5521f), [-.72, -.28, 0], [0, 0, .25])); }
