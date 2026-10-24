import type { DoorDef, FloorDef, FloorplanOptions, RoomDef, TemplateDef, WindowDef } from '@adatechnology/game-floorplan'
import { r2, withSteps } from '../util'
import type { CreateRng } from '../util'

const CABIN = { porchDepth: 1.6, bathroomWidth: 1.9, floorElevation: 0.5 } as const

type CabinConfig = { rooms: 1 | 2; power: 'grid' | 'offgrid'; solar: boolean; bathroom: 'indoor' | 'outhouse'; water: 'well' | 'tank' }

/** Log cabin: one or two rooms, wood stove, porch, outhouse or indoor bathroom, water tank on a trestle; off the grid or on it. */
export function createLogCabin(createRng: CreateRng): TemplateDef {
  const configOf = (options: FloorplanOptions): CabinConfig => {
    const draw = (key: string): number => createRng(options.seed == null ? 1 : options.seed, 'cb:' + key)()
    const rooms = options.rooms === 1 ? 1 : options.rooms === 2 ? 2 : draw('com') < 0.5 ? 1 : 2
    const power = options.power === 'grid' ? 'grid' : options.power === 'offgrid' ? 'offgrid' : draw('ene') < 0.6 ? 'offgrid' : 'grid'
    const solar = power === 'offgrid' && (options.solar != null ? !!options.solar : draw('sol') < 0.5)
    const bathroom = options.bathroom === 'indoor' ? 'indoor' : options.bathroom === 'outhouse' ? 'outhouse' : rooms === 2 && draw('ban') < 0.4 ? 'indoor' : 'outhouse'
    const water = options.water === 'well' ? 'well' : options.water === 'tank' ? 'tank' : draw('agua') < 0.4 ? 'well' : 'tank'
    return { rooms, power, solar, bathroom: rooms === 1 ? 'outhouse' : bathroom, water }
  }
  const bedroomStart = (d: number, c: CabinConfig): number => (c.rooms === 2 ? CABIN.porchDepth + Math.min(3.6, (d - CABIN.porchDepth) * 0.55) : d)

  const ground: FloorDef = {
    label: 'ground_floor', ceiling: 2.4,
    rooms: (w, d, op) => { const c = configOf(op), v1 = bedroomStart(d, c), { porchDepth } = CABIN; const L: RoomDef[] = [{ id: 'porch', type: 'porch', label: 'porch', rect: [0, 0, w, porchDepth] }]
      if (c.rooms === 1) { L.push({ id: 'living', type: 'living', label: 'cabin', library: 'living_cabin', rect: [0, porchDepth, w, d], overrides: { bed: { chance: 1, required: true } } }); return L }
      const bedroomEnd = c.bathroom === 'indoor' ? w - CABIN.bathroomWidth : w
      L.push({ id: 'living', type: 'living', label: 'living_kitchen', library: 'living_cabin', rect: [0, porchDepth, w, v1] }, { id: 'bedroom', type: 'bedroom', label: 'bedroom', library: 'bedroom_cabin', rect: [0, v1, bedroomEnd, d] })
      if (c.bathroom === 'indoor') L.push({ id: 'bathroom', type: 'bathroom', label: 'bathroom', library: 'bathroom_wc', rect: [bedroomEnd, v1, w, d] })
      return L },
    doors: (w, _d, op) => { const c = configOf(op), entrance = w * 0.3; const L: DoorDef[] = [
      { a: 'porch', b: 'outside', side: 'front', at: entrance, width: 1.2, type: 'steps', model: 'opening' },
      { a: 'living', b: 'porch', at: entrance, width: 0.9, opensTo: 'living' }]
      if (c.rooms === 2) { L.push({ a: 'living', b: 'bedroom', at: 1.2, width: 0.8, opensTo: 'bedroom' }); if (c.bathroom === 'indoor') L.push({ a: 'living', b: 'bathroom', at: w - 0.8, width: 0.7, opensTo: 'bathroom' }) }
      return withSteps(L, CABIN.floorElevation) },
    windows: (w, d, op) => { const c = configOf(op), v1 = bedroomStart(d, c), middle = (CABIN.porchDepth + v1) / 2 + 0.3; const list: WindowDef[] = [{ room: 'living', side: 'left', at: middle, width: 0.9 }, { room: 'living', side: 'right', at: middle, width: 0.9 }]
      if (c.rooms === 1) list.push({ room: 'living', side: 'back', at: w * 0.5, width: 0.9 })
      else { list.push({ room: 'bedroom', side: 'left', at: (v1 + d) / 2, width: 0.9 }, { room: 'bedroom', side: 'back', at: w * 0.3, width: 0.9 }); if (c.bathroom === 'indoor') list.push({ room: 'bathroom', side: 'right', at: (v1 + d) / 2, width: 0.6, y0: 2.0, y1: 2.35 }) }
      return list },
  }
  const tankRect = (plan: { w: number; d: number }): [number, number, number, number] => { const u = r2(plan.w + 1.3), v = r2(plan.d * 0.55), size = 0.9; return [u - size / 2, v - size / 2, u + size / 2, v + size / 2].map(r2) as [number, number, number, number] }

  return {
    id: 'log_cabin', use: 'residential_single', style: 'rural', region: 'br', place: 'cabin', construction: 'log', limits: { w: [5.2, 7.6], d: [5.6, 8.8] }, defaults: { w: 6, d: 7.6 },
    options: { rooms: [1, 2], power: ['offgrid', 'grid'], solar: [false, true], bathroom: ['outhouse', 'indoor'], water: ['tank', 'well'] }, floors: [ground],
    limitsFn: (op) => { const c = configOf(op); return c.rooms === 1 ? { w: [5.2, 7.2], d: [5.6, 7.0] } : { w: [c.bathroom === 'indoor' ? 6.4 : 5.4, 7.6], d: [7.4, 8.8] } },
    defaultsFn: (op) => (configOf(op).rooms === 1 ? { w: 6, d: 6.2 } : { w: 6.6, d: 8 }),
    config: (op) => { const c = configOf(op); return { power: c.power, solar: c.solar, bathroom: c.bathroom, water: c.water } },
    lot: (w, d, _style, op) => { const c = configOf(op), yard = Math.min(9, 18 - d); return {
      frontSetback: 6.5, marginLeft: 3.0, marginRight: 3.0, backyardDepth: yard, parking: { width: 3.4 }, garage: { u: -0.7, width: 3.0, to: 'parking' }, pedestrian: { u: w * 0.3 }, doorTarget: { a: 'porch', side: 'front' },
      libraries: { garden: 'garden_mid' }, yardZones: [{ id: 'backyard', type: 'backyard', label: 'backyard', v0: 0, v1: yard, library: `backyard_cabin_${c.bathroom === 'outhouse' ? 1 : 0}${c.water === 'well' ? 1 : 0}` }] } },
    facadeExtra: (facade, _rng, _w, _d, op) => { Object.assign(facade, { roof: createRng(op.seed == null ? 1 : op.seed, 'cb:tel')() < 0.5 ? 'wood' : 'zinc', finish: 'log', veranda: true, wood: true, porch: true, rustic: true, roofColor: 0x6a4a34 }) },
    reservations: (plan) => { const t = tankRect(plan); plan.reservations.push([t[0] - 0.4, t[1] - 0.4, t[2] + 0.4, t[3] + 0.4]) },
  }
}
