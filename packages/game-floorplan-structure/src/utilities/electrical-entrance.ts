import type { Layout } from './electrical'
import { heightOf, keyOf } from './electrical'
import type { Json } from './shared'
import { clamp, round2 } from './shared'
import { atDoor, hasWindowAt } from './wall-points'

const METER_SIZE = { w: 0.35, d: 0.2, h: 0.5 }

export const mainDoorOf = (plan: Json): Json | undefined => plan.doors.find((p: Json) => p.floor === 0 && p.exterior && p.side === 'front') || plan.doors.find((p: Json) => p.floor === 0 && p.exterior)

/** Pole, drop, meter and descent: the meter on the gate pillar (or the facade without a gate); an apartment or shop has it on the facade. */
export function placeEntrance(layout: Layout): void {
  const { plan, electrical } = layout
  const gate = plan.gates.find((g: Json) => g.type === 'pedestrian')
  const door = mainDoorOf(plan)
  const lot = plan.lot
  if (lot && plan.style !== 'commercial') {
    const rect = lot.rect
    const poleU = clamp(gate ? gate.u + 3 : plan.w / 2, rect[0] + 0.5, rect[2] - 0.5)
    const poleV = rect[1] - 0.6
    let meter: Json
    if (gate) {
      const direction = gate.u - gate.width / 2 - 0.4 >= rect[0] + 0.3 ? -1 : 1
      meter = { place: 'gate_pillar', u: round2(gate.u + direction * (gate.width / 2 + 0.25)), v: round2(gate.v), y: 1.4, side: 'front', ...METER_SIZE }
    } else meter = { place: 'facade', u: round2(door ? door.at + 1.2 : plan.w / 2), v: -0.1, y: 1.4, side: 'front', ...METER_SIZE }
    meter.id = 'meter'
    electrical.serviceEntrance = { pole: { u: round2(poleU), v: round2(poleV), h: 7.5 }, drop: [[round2(poleU), round2(poleV), 6.5], [meter.u, meter.v, 2.6]], meter, descent: [[meter.u, meter.v, 2.6], [meter.u, meter.v, 1.65]], internalRun: null }
  } else if (lot === null || plan.style === 'commercial') {
    const front = door ? { u: round2(door.at + 1.0), v: -0.1 } : { u: round2(plan.w / 2), v: -0.1 }
    electrical.serviceEntrance = {
      pole: { u: round2(front.u + 2), v: -3, h: 7.5 }, drop: [[round2(front.u + 2), -3, 6.5], [front.u, front.v, 3.2]],
      meter: { id: 'meter', place: 'facade', u: front.u, v: front.v, y: 1.4, side: 'front', ...METER_SIZE }, descent: [[front.u, front.v, 3.2], [front.u, front.v, 1.65]], internalRun: null,
    }
  }
}

/** The distribution panel in the room of the main door, on the wall nearest the meter, clear of doors and windows and of tall furniture. */
export function placePanel(layout: Layout): void {
  const { plan, rooms, electrical, pointsOf } = layout
  const door = mainDoorOf(plan)
  const room = (door && rooms.find((c) => c.id === door.a && c.floor === 0)) || rooms.find((c) => c.floor === 0) || rooms[0]
  if (!room) return
  const meter = electrical.serviceEntrance?.meter
  const targetU = meter ? meter.u : plan.w / 2
  const targetV = meter ? Math.max(0, meter.v) : 0
  let best: { point: Json; score: number } | null = null
  for (const point of pointsOf.get(keyOf(room)) ?? []) {
    if (point.blocked(1.5) || hasWindowAt(point, 1.5, 0.3) || atDoor(plan, room, point, 0.8)) continue
    const score = Math.hypot(point.u - targetU, point.v - targetV) + (point.exterior ? 0 : 3)
    if (!best || score < best.score) best = { point, score }
  }
  if (!best) best = { point: (pointsOf.get(keyOf(room)) ?? [])[0] as Json, score: 0 }
  if (best.point) {
    const p = best.point
    electrical.panel = { id: 'panel', room: room.id, floor: room.floor, u: p.u, v: p.v, y: 1.5, c: p.c, axis: p.axis, pos: p.pos, frontU: p.nu, frontV: p.nv, w: 0.3, h: 0.4, breakers: 0 }
  }
  if (electrical.serviceEntrance && electrical.panel) {
    const entrance = electrical.serviceEntrance
    entrance.internalRun = [[entrance.meter.u, entrance.meter.v, 0.1], [electrical.panel.u, electrical.panel.v, heightOf(plan, electrical.panel.floor, electrical.panel.y)]]
  }
}
