import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["diario"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L162), ported as it is: same units, same parts, same order, same materials by tag.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `survivor_diary`.
 */
export const survivorDiary: ItemModelBuilder = ({ mesh, bx, G, cloth, paper }) => G(mesh(bx(.78, 1.02, .05), paper(0x6b3f2a), [0, 0, .1]), mesh(bx(.78, 1.02, .05), paper(0x6b3f2a), [0, 0, -.1]), mesh(bx(.74, .98, .16), paper(0xe9e1cc), [.01, 0, 0]), mesh(bx(.06, 1.02, .25), paper(0x5a3322), [-.38, 0, 0]), mesh(bx(.03, 1.04, .27), cloth(0x22251f), [.25, 0, 0]), mesh(bx(.18, .3, .002), paper(0xd5c9a8), [.05, .2, .126], [0, 0, .08]))
