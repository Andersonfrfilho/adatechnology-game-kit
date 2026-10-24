import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["taco_pregos"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L157), ported as it is: same units, same parts, same order, same materials by tag.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `nail_bat`.
 */
export const nailBat: ItemModelBuilder = ({ mesh, cyl, lathe, G, metal, wood }) => { const g = G(mesh(lathe([[0, -.85], [.05, -.85], [.05, -.8], [.035, -.75], [.04, -.2], [.09, .3], [.11, .7], [.09, .82], [0, .84]], 14), wood(0xb08a5a))); const nm = metal(0x7d8186); for (let k = 0; k < 9; k++) { const a = k * 2.4, y = .25 + (k % 5) * .12; const n = mesh(cyl(.012, .012, .2, 6), nm, [Math.cos(a) * .12, y, Math.sin(a) * .12], [0, 0, 0]); n.lookAt(Math.cos(a) * 2, y, Math.sin(a) * 2); n.rotateX(Math.PI / 2); g.add(n); } return g; }
