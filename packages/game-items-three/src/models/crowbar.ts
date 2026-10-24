import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["pe_cabra"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L153), ported as it is: same units, same parts, same order, same materials by tag.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `crowbar`.
 */
export const crowbar: ItemModelBuilder = ({ T, mesh, cyl, G, metal }) => { const c = new T.CatmullRomCurve3([[0, -.8, 0], [0, .45, 0], [.02, .62, 0], [.12, .72, 0], [.26, .7, 0], [.32, .6, 0]].map(p => new T.Vector3(...p))); return G(mesh(new T.TubeGeometry(c, 30, .055, 8), metal(0x9b2a1f)), mesh(cyl(.02, .055, .14, 8), metal(0x3a3c3e), [0, -.86, 0])); }
