import type { DoorDef, FloorDef, RoomDef, TemplateDef, WindowDef } from '@adatechnology/game-floorplan'
import { MARGIN, r2, withSteps } from '../util'
import type { CreateRng } from '../util'
import { FOUNDATION_ELEVATION, WOOD_FRAME, createWoodFrameConfig } from './wood-frame-config'
import type { WoodFrameConfig } from './wood-frame-config'
import { createWoodFrameUpperFloor } from './wood-frame-upper-floor'

const FIREPLACE_LIVING = { fireplace: { chance: 1, required: true, pos: 0 }, tv_unit_right: null, tv_right: null, sofa_right: null, table_right: null, rug_right: null, tv_unit_back: { required: true, pos: 1 }, sofa_back: { required: true } }

/** Wood frame house of the suburbs: porch with steps, 1 or 2 floors, optional garage, fireplace, basement or crawl space, and attic. */
export function createWoodFrameHouse(createRng: CreateRng): TemplateDef {
  const configOf = createWoodFrameConfig(createRng)
  const geometryOf = (w: number, options: Parameters<typeof configOf>[0]) => {
    const c = configOf(options)
    const garageWidth = c.garage ? WOOD_FRAME.garageWidth : 0
    return { c, garageWidth, laundryWidth: Math.max(garageWidth, c.floors === 2 ? 2.8 : 3.0), porchDepth: WOOD_FRAME.porchDepth, stairsWidth: WOOD_FRAME.stairsWidth, v1: 6.4, kitchenEnd: w - WOOD_FRAME.stairsWidth - 2.6 }
  }
  const livingOverrides = (c: WoodFrameConfig) => (c.fireplace ? FIREPLACE_LIVING : {})
  const livingWindows = (c: WoodFrameConfig, at: number, pairWidth: number): WindowDef[] => {
    const list: WindowDef[] = c.fireplace ? [{ room: 'living', side: 'right', at, width: 1.0 }] : [{ room: 'living', side: 'right', n: 2, width: pairWidth }]
    if (!c.garage) list.push({ room: 'living', side: 'left', at: at - 0.2, width: 1.2 })
    return list
  }
  const garageDoors = (c: WoodFrameConfig, garageWidth: number): DoorDef[] =>
    c.garage ? [{ a: 'garage', b: 'laundry', at: garageWidth / 2, width: 0.9, opensTo: 'laundry' }, { a: 'garage', b: 'outside', side: 'front', at: garageWidth / 2, width: 2.6, steel: true }] : []

  const groundTwoStoreys: FloorDef = {
    label: 'ground_floor', ceiling: 2.6, openPairs: [['living', 'kitchen']],
    rooms: (w, d, op) => { const { c, garageWidth, laundryWidth, porchDepth, stairsWidth, v1, kitchenEnd } = geometryOf(w, op); const L: RoomDef[] = []
      if (c.garage) L.push({ id: 'garage', type: 'garage', label: 'garage', library: 'garage_wood_frame', rect: [0, 0, garageWidth, v1] })
      L.push({ id: 'porch', type: 'porch', label: 'porch', rect: [garageWidth, 0, w, porchDepth] },
        { id: 'living', type: 'living', label: 'living', library: 'living_wood_frame', rect: [garageWidth, porchDepth, w, v1], overrides: livingOverrides(c) },
        { id: 'laundry', type: 'laundry', label: 'laundry', library: 'laundry_wood_frame', rect: [0, v1, laundryWidth, d], overrides: c.foundation === 'basement' ? { basement_stairs: { required: true } } : {} },
        { id: 'kitchen', type: 'kitchen', label: 'kitchen', library: 'kitchen_integrated', rect: [laundryWidth, v1, kitchenEnd, d] },
        { id: 'powder_room', type: 'bathroom', label: 'powder_room', library: 'bathroom_wc', rect: [kitchenEnd, v1, w - stairsWidth, v1 + 2.2], without: ['shower'] },
        { id: 'office', type: 'office', label: 'office', rect: [kitchenEnd, v1 + 2.2, w - stairsWidth, d] },
        { id: 'stairs', type: 'stairs', label: 'stairs', rect: [w - stairsWidth, v1, w, v1 + 4.2], link: [0, 1] },
        { id: 'circulation', type: 'corridor', label: 'circulation', rect: [w - stairsWidth, v1 + 4.2, w, d] })
      return L },
    doors: (w, _d, op) => { const { c, garageWidth, stairsWidth, v1 } = geometryOf(w, op); const entrance = garageWidth + 1.9
      return withSteps([
        { a: 'porch', b: 'outside', side: 'front', at: entrance, width: 1.2, type: 'steps', model: 'opening' },
        { a: 'living', b: 'porch', at: entrance, width: 1.0, opensTo: 'living' },
        { a: 'living', b: 'stairs', at: w - 0.65, width: 0.8, opensTo: 'stairs' },
        { a: 'kitchen', b: 'laundry', width: 0.8, opensTo: 'laundry' },
        { a: 'kitchen', b: 'powder_room', width: 0.7, opensTo: 'powder_room' },
        { a: 'kitchen', b: 'office', width: 0.8, opensTo: 'office' },
        { a: 'stairs', b: 'circulation', at: w - 0.65, width: 0.8, opensTo: 'circulation' },
        { a: 'circulation', b: 'outside', side: 'back', at: w - stairsWidth / 2, width: 0.9 },
        { a: 'laundry', b: 'outside', side: 'left', at: v1 + 1.4, width: 0.85 },
        ...garageDoors(c, garageWidth),
      ], FOUNDATION_ELEVATION[c.foundation]) },
    windows: (w, d, op) => { const { c, laundryWidth, v1, kitchenEnd, stairsWidth } = geometryOf(w, op)
      return [...livingWindows(c, 4.4, 1.1),
        { room: 'kitchen', side: 'back', at: (laundryWidth + kitchenEnd) / 2, width: 1.2, y0: 1.1, y1: 2.1 }, { room: 'laundry', side: 'left', at: (v1 + d) / 2 + 1.0, width: 0.8, y0: 1.3, y1: 2.1 },
        { room: 'office', side: 'back', at: (kitchenEnd + w - stairsWidth) / 2, width: 1.2 }] },
  }

  const groundOneStorey: FloorDef = {
    label: 'ground_floor', ceiling: 2.6, openPairs: [['living', 'kitchen']],
    rooms: (w, d, op) => { const { c, garageWidth, laundryWidth, porchDepth, v1 } = geometryOf(w, op); const v2 = v1 + 3.4, vq = v2 + 1.2, bathrooms = w >= 15.6 ? 3 : 2, masterWidth = 4.2, suiteBathWidth = 2.0, socialBathWidth = 2.0, L: RoomDef[] = []
      if (c.garage) L.push({ id: 'garage', type: 'garage', label: 'garage', library: 'garage_wood_frame', rect: [0, 0, garageWidth, v1] })
      L.push({ id: 'porch', type: 'porch', label: 'porch', rect: [garageWidth, 0, w, porchDepth] },
        { id: 'living', type: 'living', label: 'living', library: 'living_wood_frame', rect: [garageWidth, porchDepth, w, v1], overrides: livingOverrides(c) },
        { id: 'laundry', type: 'laundry', label: 'laundry', library: 'laundry_wood_frame', rect: [0, v1, laundryWidth, v2] },
        { id: 'kitchen', type: 'kitchen', label: 'kitchen', library: 'kitchen_integrated', rect: [laundryWidth, v1, w - 2.2, v2] },
        { id: 'powder_room', type: 'bathroom', label: 'powder_room', library: 'bathroom_wc', rect: [w - 2.2, v1, w, v1 + 1.8], without: ['shower'] },
        { id: 'pantry', type: 'pantry', label: 'pantry', rect: [w - 2.2, v1 + 1.8, w, v2] },
        { id: 'corridor_upper', type: 'corridor', label: 'corridor', rect: [0, v2, w, vq] },
        { id: 'master', type: 'bedroom', label: 'suite_master', rect: [0, vq, masterWidth, d] },
        { id: 'bathroom_suite', type: 'bathroom', label: 'bathroom_suite', library: 'bathroom_wc', rect: [masterWidth, vq, masterWidth + suiteBathWidth, d] })
      const bedroomWidth = (w - masterWidth - suiteBathWidth - socialBathWidth) / (bathrooms - 1)
      for (let k = 0; k < bathrooms - 1; k++) { const x0 = masterWidth + suiteBathWidth + k * bedroomWidth, number = k + 2
        L.push(k < c.bedrooms - 1 ? { id: `bedroom_${number}`, type: 'bedroom', label: `bedroom_${number}`, rect: [x0, vq, x0 + bedroomWidth, d] } : { id: `bedroom_${number}`, type: 'office', label: 'office', rect: [x0, vq, x0 + bedroomWidth, d] }) }
      L.push({ id: 'bathroom_guest', type: 'bathroom', label: 'bathroom_guest', library: 'bathroom_wc', rect: [w - socialBathWidth, vq, w, d] })
      return L },
    doors: (w, _d, op) => { const { c, garageWidth, laundryWidth, v1 } = geometryOf(w, op); const v2 = v1 + 3.4, vq = v2 + 1.2, bathrooms = w >= 15.6 ? 3 : 2, masterWidth = 4.2, suiteBathWidth = 2.0, socialBathWidth = 2.0, bedroomWidth = (w - masterWidth - suiteBathWidth - socialBathWidth) / (bathrooms - 1), entrance = garageWidth + 1.9
      const bedroomDoors: DoorDef[] = Array.from({ length: bathrooms - 1 }, (_, k) => ({ a: 'corridor_upper', b: `bedroom_${k + 2}`, at: masterWidth + suiteBathWidth + k * bedroomWidth + bedroomWidth / 2, width: 0.85, opensTo: `bedroom_${k + 2}` }))
      return withSteps([
        { a: 'porch', b: 'outside', side: 'front', at: entrance, width: 1.2, type: 'steps', model: 'opening' },
        { a: 'living', b: 'porch', at: entrance, width: 1.0, opensTo: 'living' },
        { a: 'kitchen', b: 'laundry', width: 0.8, opensTo: 'laundry' },
        { a: 'kitchen', b: 'powder_room', width: 0.7, opensTo: 'powder_room' },
        { a: 'kitchen', b: 'pantry', width: 0.8, opensTo: 'pantry' },
        { a: 'corridor_upper', b: 'kitchen', at: (laundryWidth + w - 2.2) / 2, width: 0.9, opensTo: 'kitchen' },
        { a: 'corridor_upper', b: 'master', at: masterWidth / 2, width: 0.85, opensTo: 'master' },
        { a: 'master', b: 'bathroom_suite', at: vq + 1.4, width: 0.75, opensTo: 'bathroom_suite' },
        { a: 'corridor_upper', b: 'bathroom_guest', at: w - socialBathWidth / 2, width: 0.7, opensTo: 'bathroom_guest' },
        { a: 'corridor_upper', b: 'outside', side: 'right', at: v2 + 0.6, width: 0.9 },
        { a: 'laundry', b: 'outside', side: 'left', at: v1 + 1.6, width: 0.85 },
        ...bedroomDoors,
        ...garageDoors(c, garageWidth),
      ], FOUNDATION_ELEVATION[c.foundation]) },
    windows: (w, _d, op) => { const { c, v1 } = geometryOf(w, op); const v2 = v1 + 3.4, vq = v2 + 1.2, d = _d, bathrooms = w >= 15.6 ? 3 : 2, masterWidth = 4.2, suiteBathWidth = 2.0, socialBathWidth = 2.0, bedroomWidth = (w - masterWidth - suiteBathWidth - socialBathWidth) / (bathrooms - 1)
      const list: WindowDef[] = [...livingWindows(c, 4.2, 1.0),
        { room: 'laundry', side: 'left', at: v1 + 0.6, width: 0.7, y0: 1.3, y1: 2.1 }, { room: 'master', side: 'left', at: (vq + d) / 2, width: 1.2 }, { room: 'master', side: 'back', at: masterWidth / 2, width: 1.4 },
        { room: 'bathroom_suite', side: 'back', at: masterWidth + suiteBathWidth / 2, width: 0.6, y0: 2.1, y1: 2.5 }, { room: 'bathroom_guest', side: 'back', at: w - socialBathWidth / 2, width: 0.6, y0: 2.1, y1: 2.5 }]
      for (let k = 0; k < bathrooms - 1; k++) list.push({ room: `bedroom_${k + 2}`, side: 'back', at: masterWidth + suiteBathWidth + k * bedroomWidth + bedroomWidth / 2, width: 1.4 })
      return list },
  }

  const upperFloor = createWoodFrameUpperFloor(configOf)
  return {
    id: 'wood_frame_house', use: 'residential_single', style: 'rural', region: 'br', place: 'house', construction: 'wood_frame', floorRange: [1, 2],
    limits: { w: [11, 16.5], d: [12.4, 15.5] }, defaults: { w: 12.6, d: 13 },
    limitsFn: (op) => { const c = configOf(op); return c.floors === 2 ? { w: c.garage ? [11.6, 14.5] : [11, 13.5], d: [12.4, 14] } : { w: c.garage ? [13.4, 16.5] : [11.8, 15], d: [14.2, 15.5] } },
    defaultsFn: (op) => { const c = configOf(op); return c.floors === 2 ? { w: c.garage ? 12.6 : 11.6, d: 13 } : { w: c.garage ? 14.6 : 12.8, d: 14.8 } },
    options: { floors: [1, 2], garage: [true, false], fireplace: [true, false], basement: ['none', 'crawl_space', 'basement'], attic: [true, false], bedrooms: [2, 3, 4] },
    floorsFn: (op) => (configOf(op).floors === 2 ? [groundTwoStoreys, upperFloor] : [groundOneStorey]),
    config: (op) => { const c = configOf(op); return { power: 'grid', foundation: c.foundation, fireplace: c.fireplace, attic: c.attic } },
    lot: (w, d, _style, op) => { const c = configOf(op); const garageWidth = c.garage ? WOOD_FRAME.garageWidth : 0; return {
      frontSetback: 7, marginLeft: 2.2, marginRight: 2.6, backyardDepth: Math.min(Math.max(23 - d, 7), 11), parking: { width: 3.4 },
      garage: { u: c.garage ? garageWidth / 2 : -0.7, width: 3.0, to: c.garage ? 'inner_garage' : 'parking' }, pedestrian: { u: garageWidth + 1.9 }, doorTarget: { a: 'porch', side: 'front' },
      libraries: { garden: 'garden_mid', backyard: 'backyard_wood_frame', parking: c.garage ? 'access' : 'parking' } } },
    facadeExtra: (facade) => { Object.assign(facade, { roof: 'asphalt', finish: 'horizontal_boards', veranda: true, wood: true, porch: true, roofColor: 0x4a4642 }) },
    reservations: (plan) => { if (!configOf(plan.options).fireplace) return; const center = r2(WOOD_FRAME.porchDepth + MARGIN + 0.75); plan.reservations.push([plan.w, center - 0.9, plan.w + 1.0, center + 0.9]) },
  }
}
