import type { Layout } from './electrical'
import { heightOf, keyOf } from './electrical'
import { mainDoorOf } from './electrical-entrance'
import type { Json } from './shared'
import { round2 } from './shared'
import { atDoor, hasWindowAt, wallPointsOf } from './wall-points'

const LAMP_CATEGORIES = ['ceiling_light', 'lamp', 'table_light']

const lampsOf = (layout: Layout): Json[] => layout.items.filter((m) => !m.outdoor && LAMP_CATEGORIES.includes(m.category))

/** A switch by the latch of the main door of each room that has a lamp (and of the room of the front door, for the outside lamp), at 1.10 m. */
export function addSwitches(layout: Layout): void {
  const { plan, items, rooms, electrical, pointsOf } = layout
  const lamps = lampsOf(layout)
  const door = mainDoorOf(plan)
  let counter = 0
  const positionFor = (room: Json): { point: Json; door: Json; latch: boolean } | null => {
    const doors = plan.doors
      .filter((p: Json) => p.floor === room.floor && (p.a === room.id || p.b === room.id))
      .sort((a: Json, b: Json) => (a.opensTo === room.id ? 0 : 1) - (b.opensTo === room.id ? 0 : 1) || (a.width < b.width ? 1 : -1))
    const points = wallPointsOf(plan, room, items, 0.12)
    for (const tolerance of [0.16, 0.3]) {
      for (const d of doors) {
        for (const direction of [1, -1]) {
          const target = d.at + direction * (d.width / 2 + 0.18)
          const point = points.filter((q) => q.axis === d.axis && Math.abs(q.pos - d.pos) < 1e-3 && !hasWindowAt(q, 1.1, 0.2)).sort((a, b) => Math.abs(a.c - target) - Math.abs(b.c - target))[0]
          if (point && Math.abs(point.c - target) <= tolerance && !atDoor(plan, room, point, 0.0) && Math.abs(point.c - d.at) >= d.width / 2 + 0.12) return { point, door: d, latch: direction === 1 }
        }
      }
    }
    return null
  }
  for (const room of rooms.concat(plan.rooms.filter((x: Json) => ['stairs'].includes(x.type)))) {
    const roomLamps = lamps.filter((m) => m.room === room.id && m.floor === room.floor)
    const extra = door && door.a === room.id && room.floor === 0 && plan.lot ? [`outdoor_${door.id}`] : []
    if (!roomLamps.length && !extra.length) continue
    if (!pointsOf.get(keyOf(room))) pointsOf.set(keyOf(room), wallPointsOf(plan, room, items))
    const found = positionFor(room)
    if (!found) continue
    const p = found.point
    electrical.switches.push({ id: `switch${++counter}`, room: room.id, floor: room.floor, u: p.u, v: p.v, y: 1.1, c: p.c, axis: p.axis, pos: p.pos, frontU: p.nu, frontV: p.nv, door: found.door.id, latchSide: found.latch, controls: roomLamps.map((m) => m.id).concat(extra) })
  }
  if (door && plan.lot) {
    const id = `outdoor_${door.id}`
    electrical.outdoorLamps.push({ id, u: round2(door.at + door.width / 2 + 0.32), v: round2(door.pos), y: 2.15, door: door.id, switch: electrical.switches.find((s) => s.controls.includes(id))?.id ?? null })
  }
}

/** One circuit per room with sockets or switches, and the conduits: from the panel up to the ceiling, along it to the room and down to each point. */
export function addConduits(layout: Layout): void {
  const { plan, rooms, electrical } = layout
  const panel = electrical.panel
  const lamps = lampsOf(layout)
  for (const room of rooms) {
    const outlets = electrical.outlets.filter((t) => t.room === room.id && t.floor === room.floor)
    const switches = electrical.switches.filter((i) => i.room === room.id && i.floor === room.floor)
    const roomLamps = lamps.filter((m) => m.room === room.id && m.floor === room.floor)
    if (!outlets.length && !switches.length) continue
    const ceiling = (room.ceiling || plan.floors[room.floor].ceiling) - 0.12
    const part = room.parts[0]
    const centreU = round2((part[0] + part[2]) / 2)
    const centreV = round2((part[1] + part[3]) / 2)
    const circuit = { id: `circuit_${room.id}_${room.floor}`, room: room.id, floor: room.floor, outlets: outlets.map((t) => t.id), switches: switches.map((i) => i.id), lamps: roomLamps.map((m) => m.id), exposed: electrical.exposed, gauge_mm2: outlets.length > 3 ? 2.5 : 1.5 }
    electrical.circuits.push(circuit)
    const base = heightOf(plan, room.floor, 0)
    const riser = panel ? [[panel.u, panel.v, heightOf(plan, panel.floor, panel.y)], [panel.u, panel.v, heightOf(plan, panel.floor, 0) + ceiling]] : []
    if (panel) electrical.conduits.push({ id: `conduit_${circuit.id}`, circuit: circuit.id, from: 'panel', to: room.id, exposed: electrical.exposed, diameter: 0.025, points: riser.concat([[centreU, centreV, base + ceiling]]) })
    for (const point of outlets.concat(switches)) {
      electrical.conduits.push({ id: `conduit_${point.id}`, circuit: circuit.id, from: circuit.id, to: point.id, exposed: electrical.exposed, diameter: 0.02, points: [[centreU, centreV, base + ceiling], [point.u, point.v, base + ceiling], [point.u, point.v, base + point.y]] })
    }
  }
  if (panel) panel.breakers = electrical.circuits.length + 1
}
