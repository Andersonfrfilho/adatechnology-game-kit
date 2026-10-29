import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["botijao"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L164), ported as it is: same units, same parts, same order, same materials by tag.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `lpg_cylinder_13kg`.
 */
export const lpgCylinder13Kg: ItemModelBuilder = ({ mesh, cyl, bx, lathe, torus, G, metal }) => G(mesh(lathe([[0, -.6], [.38, -.6], [.42, -.55], [.45, -.3], [.45, .15], [.4, .32], [.28, .42], [.12, .46], [0, .46]], 18), metal(0x355f86)), mesh(cyl(.47, .47, .1, 18), metal(0x29486a), [0, -.62, 0]), mesh(torus(.24, .035), metal(0x29486a), [0, .58, 0], [Math.PI / 2, 0, 0]), mesh(cyl(.07, .07, .14, 10), metal(0xb8913a), [0, .5, 0]), mesh(bx(.04, .2, .04), metal(0x29486a), [.22, .5, 0]), mesh(bx(.04, .2, .04), metal(0x29486a), [-.22, .5, 0]))
