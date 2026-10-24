import type { FloorDef, FloorplanOptions, TemplateDef } from '@adatechnology/game-floorplan'
import { r2, withSteps } from '../util'
import type { CreateRng } from '../util'

const CHALET = { porchDepth: 1.8, stairsWidth: 2.2, landing: 6.0, groundCeiling: 2.6, mezzanineCeiling: 1.8 } as const
const CHALET_LIVING = { fireplace: { chance: 1, required: true, pos: 0.5 }, tv_unit_right: null, tv_right: null, sofa_right: null, table_right: null, rug_right: null, tv_unit_back: { required: true, pos: 1 }, sofa_back: { required: true } }

/** Mountain chalet: steep A-frame roof, double-height living room with a fireplace, and a mezzanine bedroom. */
export function createAFrameChalet(createRng: CreateRng): TemplateDef {
  const draw = (options: FloorplanOptions, key: string): number => createRng(options.seed == null ? 1 : options.seed, 'ch:' + key)()
  const onStilts = (options: FloorplanOptions): boolean => (draw(options, 'fund') < 0.6 && options.foundation !== 'slab') || options.foundation === 'stilts'
  const kitchenWidth = (w: number): number => r2(w * 0.45)

  const ground: FloorDef = {
    label: 'ground_floor', ceiling: CHALET.groundCeiling, openPairs: [['living', 'kitchen']],
    rooms: (w, d) => { const wk = kitchenWidth(w), x2 = w - CHALET.stairsWidth, { porchDepth, landing } = CHALET; return [
      { id: 'porch', type: 'porch', label: 'covered_deck', rect: [0, 0, w, porchDepth] },
      { id: 'living', type: 'living', label: 'living', library: 'living_wood_frame', rect: [0, porchDepth, w, landing], ceiling: CHALET.groundCeiling + CHALET.mezzanineCeiling, overrides: CHALET_LIVING },
      { id: 'kitchen', type: 'kitchen', label: 'kitchen', library: 'kitchen_integrated', rect: [0, landing, wk, d] },
      { id: 'bathroom', type: 'bathroom', label: 'bathroom', library: 'bathroom_wc', rect: [wk, landing, x2, landing + 2.4] },
      { id: 'pantry', type: 'pantry', label: 'pantry', rect: [wk, landing + 2.4, x2, d] },
      { id: 'stairs', type: 'stairs', label: 'stairs', rect: [x2, landing, w, d], link: [0, 1], overrides: { stairs: { pos: 1 } } },
    ] },
    doors: (w, _d, op) => { const x2 = w - CHALET.stairsWidth; return withSteps([
      { a: 'porch', b: 'outside', side: 'front', at: w * 0.3, width: 1.2, type: 'steps', model: 'opening' },
      { a: 'living', b: 'porch', at: w * 0.3, width: 1.2, opensTo: 'living' },
      { a: 'living', b: 'stairs', at: x2 + 0.65, width: 0.8, opensTo: 'stairs' },
      { a: 'kitchen', b: 'bathroom', width: 0.75, opensTo: 'bathroom' },
      { a: 'kitchen', b: 'pantry', width: 0.8, opensTo: 'pantry' },
      { a: 'pantry', b: 'outside', side: 'back', width: 0.9 },
    ], onStilts(op) ? 0.9 : 0.2) },
    windows: (w, d) => { const wk = kitchenWidth(w); return [
      { room: 'living', side: 'left', n: 2, width: 1.0, y0: 0.9, y1: 3.3 },
      { room: 'kitchen', side: 'left', at: (CHALET.landing + d) / 2, width: 1.0, y0: 1.1, y1: 2.1 }, { room: 'kitchen', side: 'back', at: wk / 2 + 0.9, width: 1.0, y0: 1.1, y1: 2.1 },
      { room: 'pantry', side: 'back', at: (wk + w - CHALET.stairsWidth) / 2, width: 0.6, y0: 1.5, y1: 2.1 },
    ] },
  }
  const mezzanine: FloorDef = {
    label: 'mezzanine', ceiling: CHALET.mezzanineCeiling,
    rooms: (w, d) => { const x2 = w - CHALET.stairsWidth; return [
      { id: 'void_living', type: 'void', label: 'void_living', rect: [0, CHALET.porchDepth, w, CHALET.landing] },
      { id: 'loft_bedroom', type: 'bedroom', label: 'loft_bedroom', rect: [0, CHALET.landing, x2, d] },
      { id: 'stairs_upper', type: 'stairs', label: 'stairs', rect: [x2, CHALET.landing, w, d], link: [0, 1], overrides: { stairs: { pos: 1 } } },
    ] },
    doors: (_w, d) => [{ a: 'loft_bedroom', b: 'stairs_upper', at: (CHALET.landing + d) / 2 + 0.6, width: 0.8, opensTo: 'loft_bedroom' }],
    windows: (w, d) => [
      { room: 'loft_bedroom', side: 'back', at: (w - CHALET.stairsWidth) / 2, width: 1.6, y0: 0.5, y1: 1.7 },
      { room: 'loft_bedroom', side: 'left', at: (CHALET.landing + d) / 2, width: 1.2, y0: 0.5, y1: 1.7 },
    ],
  }

  return {
    id: 'a_frame_chalet', use: 'residential_single', style: 'rural', region: 'br', place: 'cabin', construction: 'wood_frame', limits: { w: [7.5, 9.5], d: [10, 12] }, defaults: { w: 8.5, d: 11 },
    options: { foundation: ['stilts', 'slab'] }, cumulativeCeilings: true, floors: [ground, mezzanine],
    config: (op) => ({ power: 'grid', foundation: onStilts(op) ? 'stilts' : 'slab' }),
    lot: (w) => ({
      frontSetback: 8, marginLeft: 3.2, marginRight: 3.2, backyardDepth: 9, parking: { width: 3.4 }, garage: { u: -1.0, width: 3.0, to: 'parking' }, pedestrian: { u: w * 0.3 }, doorTarget: { a: 'porch', side: 'front' },
      libraries: { garden: 'garden_mid', backyard: 'backyard_rural' },
    }),
    facadeExtra: (facade, _rng, _w, _d, op) => { Object.assign(facade, { roof: draw(op, 'tel') < 0.5 ? 'colonial' : 'wood', finish: 'vertical_boards', veranda: true, wood: true, porch: true, a_frame: true, gable: true, roofColor: 0x5a3e2e }) },
    reservations: (plan) => { const center = r2((CHALET.porchDepth + CHALET.landing) / 2); plan.reservations.push([plan.w, center - 0.9, plan.w + 1.1, center + 0.9]) },
  }
}
