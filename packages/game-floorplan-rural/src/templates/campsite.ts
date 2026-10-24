import type { FloorDef, FloorplanOptions, TemplateDef } from '@adatechnology/game-floorplan'
import { r2 } from '../util'
import type { CreateRng } from '../util'

type Rect = [number, number, number, number]
type TentKind = 'dome' | 'tunnel'
type Tent = { id: string; rect: Rect; side: 'left' | 'right'; height: number; people: number; kind: TentKind }

const TENT_LENGTH: Record<number, number> = { 1: 1.15, 2: 1.75, 3: 2.35, 4: 2.95 }
const TENT_DEPTH = 2.4
const TENT_HEIGHT: Record<TentKind, Record<number, number>> = { dome: { 1: 1.1, 2: 1.25, 3: 1.4, 4: 1.5 }, tunnel: { 1: 1.0, 2: 1.15, 3: 1.3, 4: 1.4 } }

/** Campsite: one to four tents (dome or tunnel) in two columns around an entrance corridor, a campfire at the back, no walls and no mains. */
export function createCampsite(createRng: CreateRng): TemplateDef {
  const layoutOf = (w: number, options: FloorplanOptions): { tents: Tent[]; end: number; reach: number } => {
    const draw = (key: string): number => createRng(options.seed == null ? 1 : options.seed, 'cp:' + key)()
    const count = [1, 2, 3, 4].includes(options.tents) ? (options.tents as number) : 2 + Math.floor(draw('n') * 3)
    const forcedKind = options.tentType === 'dome' || options.tentType === 'tunnel' ? options.tentType : null
    const cursor = [0.8, 0.8]
    const tents: Tent[] = []
    for (let i = 0; i < count; i++) {
      const people = 1 + Math.floor(draw('p' + i) * 4)
      const kind: TentKind = forcedKind ?? (draw('t' + i) < 0.5 ? 'dome' : 'tunnel')
      const column = i % 2, length = TENT_LENGTH[people] as number, start = cursor[column] as number
      const rect: Rect = column === 0 ? [0.6, start, 0.6 + TENT_DEPTH, start + length] : [w - 0.6 - TENT_DEPTH, start, w - 0.6, start + length]
      cursor[column] = start + length + 0.9
      tents.push({ id: `tent_${i + 1}`, rect, side: column === 0 ? 'right' : 'left', height: (TENT_HEIGHT[kind][people] as number), people, kind })
    }
    const end = Math.max(...tents.map((t) => (t.rect[1] + t.rect[3]) / 2)) + 0.5
    return { tents, end: r2(end), reach: Math.max(cursor[0] as number, cursor[1] as number) - 0.9 }
  }
  const depthOf = (options: FloorplanOptions): number => { const layout = layoutOf(11, options); return r2(Math.max(layout.end + 2.7, layout.reach + 2.7)) }

  const ground: FloorDef = {
    label: 'ground_floor', ceiling: 1.5,
    rooms: (w, _d, op) => layoutOf(w, op).tents.map((t) => ({ id: t.id, type: 'tent', label: `tent_${t.kind}_${t.people}`, library: `tent_${t.people}`, rect: t.rect })),
    doors: (w, _d, op) => layoutOf(w, op).tents.map((t) => ({
      a: t.id, b: 'outside', side: t.side, edge: { axis: 'v' as const, pos: t.side === 'right' ? t.rect[2] : t.rect[0], a0: t.rect[1], a1: t.rect[3] }, at: (t.rect[1] + t.rect[3]) / 2, width: 0.75, type: 'zip', model: 'zip', opensTo: t.id,
    })),
    windows: () => [],
  }

  return {
    id: 'campsite', use: 'recreational', style: 'rural', region: 'br', place: 'camp', construction: 'canvas', noWalls: true, limits: { w: [9.4, 12.6], d: [8, 20] }, defaults: { w: 10.6, d: 10 },
    options: { tents: [1, 2, 3, 4], tentType: ['dome', 'tunnel'] }, floors: [ground],
    limitsFn: (op) => { const depth = depthOf(op); return { w: [9.4, 12.6], d: [depth, depth + 3] } },
    defaultsFn: (op) => ({ w: 10.6, d: depthOf(op) + 0.4 }),
    config: () => ({ power: 'offgrid', solar: false }),
    lot: (w, d) => ({
      frontSetback: 3.2, marginLeft: 0.9, marginRight: 0.9, backyardDepth: 2.4, pedestrian: { u: w / 2 }, libraries: { garden: 'garden_camping', sideYard: 'empty' }, grounds: { campsite: 'dirt', garden: 'lawn', backyard: 'lawn' },
      extraZones: [{ id: 'campsite', type: 'camp', label: 'campsite', parts: [[0, 0, w, d]], library: 'campsite' }],
      yardZones: [{ id: 'backyard', type: 'backyard', label: 'clearing', v0: 0, v1: 2.4, library: 'backyard_camping' }],
    }),
    facadeExtra: (facade) => { Object.assign(facade, { roof: 'canvas', finish: 'canvas', noBuilding: true, rustic: true, porch: false, roofColor: 0x3f6fa0 }) },
    reservations: (plan) => { for (const t of layoutOf(plan.w, plan.options).tents) plan.reservations.push([t.rect[0] - 0.25, t.rect[1] - 0.25, t.rect[2] + 0.25, t.rect[3] + 0.25]) },
    paths: (plan, context) => {
      const gate = context.gates.find((g) => g.type === 'pedestrian')
      if (!gate) return []
      const middle = plan.w / 2, half = 0.5, trunk: Rect = [middle - half, -context.setback, middle + half, layoutOf(plan.w, plan.options).end]
      return layoutOf(plan.w, plan.options).tents.map((t) => {
        const door = plan.doors.find((q) => q.a === t.id && q.exterior)
        const center = (t.rect[1] + t.rect[3]) / 2
        const stub: Rect = t.side === 'right' ? [t.rect[2], center - half, middle - half, center + half] : [middle + half, center - half, t.rect[0], center + half]
        return { id: `path_${door.id}`, type: 'pedestrian', from: gate.id, to: door.id, width: 1.0, rects: [stub, trunk].map((q) => q.map(r2)), points: [[middle, -context.setback], [middle, center], [t.side === 'right' ? t.rect[2] : t.rect[0], center]].map((q) => q.map(r2)) }
      }) },
  }
}
