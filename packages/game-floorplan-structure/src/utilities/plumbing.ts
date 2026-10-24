import type { Json } from './shared'
import { round2 } from './shared'
import type { WaterTank } from '../types'

const FIXTURES: Record<string, string> = { kitchen_cabinet: 'tap', washbasin: 'tap', shower: 'shower', toilet: 'flush', laundry_tub: 'tub', washing_machine: 'machine' }
const FLOW_LPM: Record<string, number> = { tap: 6, shower: 9, flush: 6, tub: 8, machine: 12 }
const POINT_HEIGHT: Record<string, number> = { shower: 2.1, flush: 0.9, machine: 0.8 }
const DEFAULT_CAPACITY = { budget: 500, mid: 1000 }

export interface PlumbingContext {
  plan: Json
  items: Json[]
  tank: WaterTank | null
}

const absolute = (plan: Json, floor: number, y: number): number => (plan.floors[floor] ? plan.floors[floor].y0 : 0) + y

/**
 * Plumbing as logic: a point for every tap, shower, toilet, tub and machine, and the runs you can see: the outlet of the tank, under each sink and in the wall
 * from the tank to every wet room (hidden in the wall, it shows only where the wall breaks).
 */
export function planPlumbing(context: PlumbingContext): Json {
  const { plan, items, tank } = context
  const fixtures = items.filter((m) => FIXTURES[m.category] && !m.decor)
  const points: Json[] = []
  const runs: Json[] = []
  const capacity = tank?.capacity ?? (plan.style === 'budget' ? DEFAULT_CAPACITY.budget : plan.style === 'mid' ? DEFAULT_CAPACITY.mid : plan.tpl?.id === 'mansion' ? 3000 : 2000)
  const plumbing: Json = { tank: tank ? 'water_tank' : null, capacityL: tank || !plan.tpl.noWalls ? capacity : 0, points, visibleRuns: runs }
  const top = plan.floors.length - 1
  fixtures.forEach((item, index) => {
    const kind = FIXTURES[item.category]!
    points.push({ id: `pt${index + 1}`, kind, item: item.id, room: item.room, floor: item.outdoor ? -1 : item.floor, u: item.x, v: item.z, y: POINT_HEIGHT[kind] ?? 0.9, flowLpm: FLOW_LPM[kind], run: null })
  })
  if (!tank) return plumbing
  const slabY = absolute(plan, top, plan.floors[top].ceiling)
  const tankY = tank.place === 'raised_slab' ? tank.platform!.topY : tank.place === 'attic' ? slabY + 0.5 : tank.y
  runs.push({ id: 'run_outlet', from: 'water_tank', to: 'ceiling', points: [[tank.u, tank.v, round2(tankY + 0.15)], [tank.u, tank.v, round2(slabY - 0.15)]], diameter: 0.032, exposed: 'tank_outlet' })
  for (const point of points) {
    const item = fixtures.find((x) => x.id === point.item)!
    if (point.kind !== 'tap' || item.outdoor) continue
    const front = [item.frontU || 0, item.frontV || 1]
    const behind = [item.x - front[0]! * (item.d / 2 + 0.02), item.z - front[1]! * (item.d / 2 + 0.02)]
    runs.push({ id: `run_under_${point.id}`, from: 'valve', to: point.id, points: [[round2(behind[0]!), round2(behind[1]!), absolute(plan, item.floor, 0.5)], [item.x, item.z, absolute(plan, item.floor, 0.5)], [item.x, item.z, absolute(plan, item.floor, 0.75)]], diameter: 0.025, exposed: 'under_sink' })
  }
  const wet: { room: string; floor: number; points: Json[] }[] = []
  for (const point of points) {
    if (!wet.some((c) => c.room === point.room && c.floor === point.floor)) wet.push({ room: point.room, floor: point.floor, points: points.filter((q) => q.room === point.room && q.floor === point.floor) })
  }
  for (const room of wet) {
    const found = plan.rooms.find((c: Json) => c.id === room.room && c.floor === room.floor)
    const zone = plan.zones.find((z: Json) => z.id === room.room)
    const parts = (found || zone || { parts: [[tank.u, tank.v, tank.u, tank.v]] }).parts
    const centreU = (parts[0][0] + parts[0][2]) / 2
    const centreV = (parts[0][1] + parts[0][3]) / 2
    const ceiling = found ? found.ceiling || plan.floors[found.floor].ceiling : 2.8
    const y0 = found ? absolute(plan, found.floor, 0) : 0
    const id = `run_wall_${room.room}${room.floor === -1 ? '_outside' : `_${room.floor}`}`
    runs.push({ id, from: 'water_tank', to: room.room, points: [[tank.u, tank.v, round2(slabY - 0.15)], [round2(centreU), round2(centreV), round2(slabY - 0.15)], [round2(centreU), round2(centreV), round2(y0 + ceiling - 0.15)], [round2(centreU), round2(centreV), round2(y0 + 0.6)]], diameter: 0.025, exposed: 'wall' })
    for (const point of room.points) point.run = id
  }
  return plumbing
}
