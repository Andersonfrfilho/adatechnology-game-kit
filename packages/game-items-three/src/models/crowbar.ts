import type * as THREE_NS from 'three'
import { markShared } from '@adatechnology/game-shapes-three'

import type { ItemModelBuilder } from './registry'

/**
 * `MODELS["pe_cabra"]` of the Itens do Vale Cinzento showcase (`armas-itens__itens-vale-cinzento.js` L153), corrected to the shape of a real crowbar as the free photo shows it
 * (Wikimedia Commons, "Crowbar without haft.jpg"): the team's bar in the same units, its gooseneck bent tighter as on the real one, now a hexagonal steel bar instead of a round tube,
 * ending at the top in the gooseneck's flattened, forked claw and at the bottom in the flat chisel (the team's round stub). Plain forged steel as in the photo, the two working ends ground brighter.
 * It draws in the units of the page; `data/models.json` gives the scale to metres of the item `crowbar` (75 cm).
 */

// the team's curve with the photo's tighter gooseneck: the straight bar, then the bend of about 130 degrees into the claw, which points back and away from the bar
const CURVE: ReadonlyArray<readonly [number, number, number]> = [[0, -0.8, 0], [0, 0.5, 0], [0.012, 0.625, 0], [0.06, 0.7, 0], [0.12, 0.715, 0], [0.19, 0.685, 0], [0.26, 0.63, 0]]
// 23 mm across the corners at the item's scale: the 7/8 in hex bar of a 30 in crowbar (the team's round tube was 49 mm thick)
const BAR_RADIUS = 0.026

// the chisel's side profile: the bar flattened into a wedge, its edge a little off the bar's axis as forged
const CHISEL: ReadonlyArray<readonly [number, number]> = [[-0.024, -0.79], [0.024, -0.79], [0.016, -0.86], [0.004, -0.928], [-0.008, -0.928], [-0.022, -0.86]]
const CHISEL_WIDTH = 0.06

type Shapes = { readonly bar: THREE_NS.TubeGeometry; readonly chisel: THREE_NS.ExtrudeGeometry }
const shapes = new WeakMap<object, Shapes>()

/** The hexagonal bar along the curve and the chisel, built once per three.js and shared by every crowbar. */
const shapesOf = (T: typeof THREE_NS, extrude: (points: ReadonlyArray<readonly [number, number]>, depth: number, bevel?: number) => THREE_NS.ExtrudeGeometry): Shapes => {
  const cached = shapes.get(T)
  if (cached) return cached
  const curve = new T.CatmullRomCurve3(CURVE.map((point) => new T.Vector3(...point)))
  const bar = new T.TubeGeometry(curve, 30, BAR_RADIUS, 6)
  const chisel = extrude(CHISEL, CHISEL_WIDTH, 0.004)
  chisel.translate(0, 0, -CHISEL_WIDTH / 2)
  markShared(bar)
  markShared(chisel)
  const made = { bar, chisel }
  shapes.set(T, made)
  return made
}

export const crowbar: ItemModelBuilder = ({ T, mesh, bx, extrude, G, metal }) => {
  const forged = metal(0x767b7f)
  const steel = metal(0x8d9194)
  // the claw: two flattened prongs leaving the end of the gooseneck downwards, a V between them for a nail head
  const end = CURVE[CURVE.length - 1] as readonly [number, number, number]
  const before = CURVE[CURVE.length - 2] as readonly [number, number, number]
  const angle = Math.atan2(end[1] - before[1], end[0] - before[0])
  const along = (distance: number): [number, number, number] => [end[0] + Math.cos(angle) * distance, end[1] + Math.sin(angle) * distance, 0]
  const prongs = [-1, 1].map((side) => mesh(bx(0.1, 0.016, 0.022), steel, [...along(0.03)].map((value, index) => (index === 2 ? side * 0.014 : value)) as [number, number, number], [0, 0, angle]))
  const { bar, chisel } = shapesOf(T, extrude)
  return G(mesh(bar, forged), mesh(chisel, steel), ...prongs)
}
