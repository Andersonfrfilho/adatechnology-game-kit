import type { DoorDef, FloorDef, FloorplanOptions, RoomDef, TemplateDef, WindowDef } from '@adatechnology/game-floorplan'
import { r2 } from '../util'
import type { CreateRng } from '../util'

const SHACK_BATHROOM_WIDTH = 1.7
const SHACK_FINISH = { wood: 'old_boards', zinc: 'zinc_sheet', mixed: 'scrap_mix' } as const

type ShackConfig = { rooms: 1 | 2; material: 'wood' | 'zinc' | 'mixed'; floorSurface: 'dirt' | 'concrete'; bathroom: 'indoor' | 'outside' }

/** Improvised shack of scrap boards and zinc sheets: one or two rooms, dirt or concrete floor, a tapped power line and a water tank on a trestle. */
export function createShack(createRng: CreateRng): TemplateDef {
  const configOf = (options: FloorplanOptions): ShackConfig => {
    const draw = (key: string): number => createRng(options.seed == null ? 1 : options.seed, 'bc:' + key)()
    const rooms = options.rooms === 1 ? 1 : options.rooms === 2 ? 2 : draw('com') < 0.5 ? 1 : 2
    const materials = ['wood', 'zinc', 'mixed'] as const
    const material = materials.find((name) => name === options.material) ?? materials[Math.floor(draw('mat') * 3)] ?? 'wood'
    const floorSurface = options.floorSurface === 'dirt' || options.floorSurface === 'concrete' ? options.floorSurface : draw('piso') < 0.45 ? 'dirt' : 'concrete'
    const bathroom = rooms === 2 && (options.bathroom === 'indoor' || (options.bathroom !== 'outside' && draw('ban') < 0.4)) ? 'indoor' : 'outside'
    return { rooms, material, floorSurface, bathroom }
  }
  const bedroomStart = (d: number, c: ShackConfig): number => (c.rooms === 2 ? Math.min(3.0, r2(d * 0.5)) : d)

  const ground: FloorDef = {
    label: 'ground_floor', ceiling: 2.2,
    rooms: (w, d, op) => { const c = configOf(op), v1 = bedroomStart(d, c)
      if (c.rooms === 1) return [{ id: 'living', type: 'living', label: 'shack', library: 'living_shack', rect: [0, 0, w, d], overrides: { bed: { chance: 1, required: true } } }]
      const bedroomEnd = c.bathroom === 'indoor' ? w - SHACK_BATHROOM_WIDTH : w
      const L: RoomDef[] = [{ id: 'living', type: 'living', label: 'living_kitchen', library: 'living_shack', rect: [0, 0, w, v1] }, { id: 'bedroom', type: 'bedroom', label: 'bedroom', library: 'bedroom_shack', rect: [0, v1, bedroomEnd, d] }]
      if (c.bathroom === 'indoor') L.push({ id: 'bathroom', type: 'bathroom', label: 'bathroom', library: 'bathroom_wc', rect: [bedroomEnd, v1, w, d], without: ['shower'] })
      return L },
    doors: (w, _d, op) => { const c = configOf(op); const L: DoorDef[] = [{ a: 'living', b: 'outside', side: 'front', at: w * 0.3, width: 0.8, opensTo: 'living' }]
      if (c.rooms === 2) { L.push({ a: 'living', b: 'bedroom', at: 0.9, width: 0.7, opensTo: 'bedroom' }); if (c.bathroom === 'indoor') L.push({ a: 'living', b: 'bathroom', at: w - 0.85, width: 0.75, opensTo: 'bathroom' }) }
      return L },
    windows: (w, d, op) => { const c = configOf(op), v1 = bedroomStart(d, c); const list: WindowDef[] = [{ room: 'living', side: 'right', at: v1 * 0.55, width: 0.6, y0: 1.1, y1: 1.7 }]
      if (c.rooms === 1) list.push({ room: 'living', side: 'back', at: w * 0.5, width: 0.6, y0: 1.1, y1: 1.7 })
      else list.push({ room: 'bedroom', side: 'left', at: (v1 + d) / 2, width: 0.6, y0: 1.1, y1: 1.7 })
      return list },
  }

  return {
    id: 'shack', use: 'residential_single', style: 'rural', region: 'br', place: 'shack', construction: 'improvised', limits: { w: [3.6, 5.2], d: [4.4, 6.6] }, defaults: { w: 4.2, d: 5.0 },
    options: { rooms: [1, 2], material: ['wood', 'zinc', 'mixed'], floorSurface: ['dirt', 'concrete'], bathroom: ['outside', 'indoor'] }, floors: [ground],
    limitsFn: (op) => { const c = configOf(op); return c.rooms === 1 ? { w: [3.8, 4.8], d: [4.4, 5.4] } : { w: [c.bathroom === 'indoor' ? 4.2 : 3.6, 5.2], d: [5.6, 6.6] } },
    defaultsFn: (op) => (configOf(op).rooms === 1 ? { w: 4.2, d: 4.8 } : { w: 4.4, d: 6 }),
    config: (op) => { const c = configOf(op); return { power: 'tap', solar: false, material: c.material, floorSurface: c.floorSurface, bathroom: c.bathroom } },
    lot: (w, d, _style, op) => { const yard = Math.min(6, 14 - d); return {
      frontSetback: 2.6, marginLeft: 1.0, marginRight: 1.6, backyardDepth: yard, pedestrian: { u: w * 0.3 }, doorTarget: { a: 'living', side: 'front' },
      yardZones: [{ id: 'backyard', type: 'backyard', label: 'backyard', v0: 0, v1: yard, library: `backyard_cabin_${configOf(op).bathroom === 'outside' ? 1 : 0}0` }] } },
    facadeExtra: (facade, _rng, _w, _d, op) => { Object.assign(facade, { roof: 'zinc', finish: SHACK_FINISH[configOf(op).material], improvised: true, rustic: true, porch: false, roofColor: 0x8a8f94 }) },
    reservations: (plan) => { const u = r2(plan.w + 0.95), v = r2(plan.d * 0.5), size = 0.8, t = [u - size / 2, v - size / 2, u + size / 2, v + size / 2].map(r2) as [number, number, number, number]; plan.reservations.push([t[0] - 0.4, t[1] - 0.4, t[2] + 0.4, t[3] + 0.4]) },
  }
}
