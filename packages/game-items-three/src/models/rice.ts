import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["arroz"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L147), ported as it is: same units, same parts, same order, same materials by tag.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `rice`.
 */
export const rice: ItemModelBuilder = ({ mesh, bx, G, paper, food }) => G(mesh(bx(.7, .95, .28), paper(0xe6dcc0)), mesh(bx(.72, .12, .1), paper(0xd5c9a8), [0, .52, 0]), mesh(bx(.5, .3, .02), food(0xb5521f), [0, .05, .15]), mesh(bx(.3, .1, .02), paper(0x3f7a45), [0, -.25, .15]))
