import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["mochila_trilha"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L158), ported as it is: same units, same parts, same order, same materials by tag.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `hiking_backpack_40l`.
 */
export const hikingBackpack40L: ItemModelBuilder = ({ T, mesh, bx, G, cloth, plastic }) => { const c = cloth(0x4f6b3a), d = cloth(0x36472a); return G(mesh(bx(.78, .9, .42), c), mesh(new T.SphereGeometry(.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), c, [0, .44, 0], [0, 0, 0], [.98, .45, .53]), mesh(bx(.56, .4, .16), d, [0, -.15, .27]), mesh(bx(.8, .12, .46), d, [0, .2, 0]), mesh(bx(.06, .9, .06), cloth(0x22251f), [-.22, 0, -.24]), mesh(bx(.06, .9, .06), cloth(0x22251f), [.22, 0, -.24]), mesh(bx(.1, .08, .04), plastic(0xd9a441), [0, .2, .24])); }
