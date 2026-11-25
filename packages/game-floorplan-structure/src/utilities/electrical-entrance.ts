import type { Plan, PlanDoor } from '@adatechnology/game-floorplan'
import type { Layout } from './electrical'
import { heightOf, keyOf } from './electrical'
import { clamp, round2 } from './shared'
import { atDoor, hasWindowAt } from './wall-points'
import type { WallPoint } from './wall-points'
import type { ElectricMeter } from './types'
import { networkStreetOf } from './electrical-types'
import { clashes, panelBox, plateBox, spotOf, wallItemBoxesOf } from './wall-reservations'

const METER_SIZE = { w: 0.35, d: 0.2, h: 0.5 }
/** The service pole stands on the sidewalk this far in front of the lot's front edge (metres), never inside the lot nor past the sidewalk onto the road. */
export const SERVICE_POLE_OUTSIDE_LOT = 0.6
/** Without a lot the street is unknown: the pole stands this far in front of the facade. */
const SERVICE_POLE_NO_LOT = 3
/** With the street's own poles, the entrance post stands this far inside the lot's front edge (metres): behind the front wall, never on the sidewalk. */
export const SERVICE_POST_INSIDE_LOT = 0.35
/** The least front yard (metres) that holds the entrance post clear of the facade; a house with less has its meter on the facade and no post. */
export const SERVICE_POST_MIN_YARD = 1.2
/**
 * On a street with a utility network (`street: 'network'`) the meter post (padrão) is a slim square post this tall over the ground (`half` its
 * half width), the network's drop anchored on its street face this high, the meter box at its foot and the conduit down its face (metres).
 */
export const NETWORK_POST = { h: 6, anchor: 5.7, half: 0.07, bracket: 0.06, conduitOff: 0.025 } as const
/** The mast stands this far out of the meter's face (clear of the thickest wall's render), and rises this far over the drop's anchor to its weatherhead. */
const MAST_OFF_WALL = 0.05
const MAST_OVER_ANCHOR = 0.15
/** The post of a street that only brings its poles (`streetPoles`): as tall as the street's, the drop anchored this high. */
const STREET_POST = { h: 7.5, anchor: 6.5 } as const

export const mainDoorOf = (plan: Plan): PlanDoor | undefined => plan.doors.find((p) => p.floor === 0 && p.exterior && p.side === 'front') || plan.doors.find((p) => p.floor === 0 && p.exterior)

/** Pole, drop, meter and descent: the meter on the gate pillar (or the facade without a gate); an apartment or shop has it on the facade. */
export function placeEntrance(layout: Layout): void {
  const { plan, electrical } = layout
  const gate = plan.gates.find((g) => g.type === 'pedestrian')
  const door = mainDoorOf(plan)
  const lot = plan.lot
  if (lot && plan.style !== 'commercial') {
    const rect = lot.rect
    const poleU = clamp(gate ? gate.u + 3 : plan.w / 2, rect[0] + 0.5, rect[2] - 0.5)
    const poleV = rect[1] - SERVICE_POLE_OUTSIDE_LOT
    let placed: Omit<ElectricMeter, 'id'>
    if (gate) {
      const direction = gate.u - gate.width / 2 - 0.4 >= rect[0] + 0.3 ? -1 : 1
      placed = { place: 'gate_pillar', u: round2(gate.u + direction * (gate.width / 2 + 0.25)), v: round2(gate.v), y: 1.4, side: 'front', ...METER_SIZE }
    } else placed = { place: 'facade', u: round2(door ? door.at + 1.2 : plan.w / 2), v: -0.1, y: 1.4, side: 'front', ...METER_SIZE }
    const meter: ElectricMeter = Object.assign(placed, { id: 'meter' })
    if (fromStreet(layout)) return void (electrical.serviceEntrance = streetEntrance({ plan, meter, poleU: round2(poleU), door, network: networkStreetOf(layout.street) }))
    electrical.serviceEntrance = { pole: { u: round2(poleU), v: round2(poleV), h: 7.5 }, drop: [[round2(poleU), round2(poleV), 6.5], [meter.u, meter.v, 2.6]], meter, descent: [[meter.u, meter.v, 2.6], [meter.u, meter.v, 1.65]], internalRun: null }
  } else if (lot === null || plan.style === 'commercial') {
    const front = door ? { u: round2(door.at + 1.0), v: -0.1 } : { u: round2(plan.w / 2), v: -0.1 }
    // a shop on a lot has the pole where a house has it, in front of the lot's edge: 3 m from the facade put it on the road when the lot starts at the facade (the Visor's golden keeps the 3 m)
    if (lot && fromStreet(layout)) return void (electrical.serviceEntrance = streetEntrance({ plan, meter: { id: 'meter', place: 'facade', u: front.u, v: front.v, y: 1.4, side: 'front', ...METER_SIZE }, poleU: round2(front.u + 2), door, network: networkStreetOf(layout.street) }))
    const poleV = lot && !layout.visor ? round2(lot.rect[1] - SERVICE_POLE_OUTSIDE_LOT) : -SERVICE_POLE_NO_LOT
    electrical.serviceEntrance = {
      pole: { u: round2(front.u + 2), v: poleV, h: 7.5 }, drop: [[round2(front.u + 2), poleV, 6.5], [front.u, front.v, 3.2]],
      meter: { id: 'meter', place: 'facade', u: front.u, v: front.v, y: 1.4, side: 'front', ...METER_SIZE }, descent: [[front.u, front.v, 3.2], [front.u, front.v, 1.65]], internalRun: null,
    }
  }
}

/**
 * The entrance of a house on a street that brings its own poles: the post (padrão) stands inside the lot, `SERVICE_POST_INSIDE_LOT` behind its front edge, with the drop from it to the
 * meter; a house whose front yard is too shallow for it has no post, and the street's drop lands on the facade over the meter. The street's drop lands at `drop[0]` either way.
 */
type StreetEntranceParams = { readonly plan: Plan; readonly meter: ElectricMeter; readonly poleU: number; readonly door: PlanDoor | undefined; readonly network: 'network' | 'network_underground' | undefined }

function streetEntrance({ plan, meter, poleU, door, network }: StreetEntranceParams): NonNullable<Layout['electrical']['serviceEntrance']> {
  if (network === 'network_underground') return undergroundEntrance(meter)
  const front = plan.lot?.rect[1] ?? 0
  const head: [number, number, number] = [meter.u, meter.v, meter.place === 'facade' ? 3.2 : 2.6]
  const descent: [number, number, number][] = [head, [meter.u, meter.v, 1.65]]
  const mode = network === 'network' ? { street: 'network' as const } : {}
  if (-front < SERVICE_POST_MIN_YARD) {
    const facade: ElectricMeter = meter.place === 'facade' ? meter : { ...meter, place: 'facade', u: round2(door ? door.at + 1.2 : plan.w / 2), v: -0.1 }
    if (network === 'network') return mastEntrance(facade)
    const top: [number, number, number] = [facade.u, facade.v, 3.2]
    return { ...mode, pole: null, drop: [top], meter: facade, descent: [top, [facade.u, facade.v, 1.65]], internalRun: null }
  }
  if (network === 'network') return postEntrance({ meter, u: poleU, v: round2(front + SERVICE_POST_INSIDE_LOT) })
  const post = { u: poleU, v: round2(front + SERVICE_POST_INSIDE_LOT), h: STREET_POST.h }
  return { ...mode, pole: post, drop: [[post.u, post.v, STREET_POST.anchor], head], meter, descent, internalRun: null }
}

/**
 * The padrão of a house on a network: the drop anchored on the post's street face, the meter box at the post's foot on that face, and the
 * conduit straight down the face from under the anchor into the box: no wire runs from the post to anywhere else.
 */
function postEntrance({ meter, u, v }: { readonly meter: ElectricMeter; readonly u: number; readonly v: number }): NonNullable<Layout['electrical']['serviceEntrance']> {
  const face = v - NETWORK_POST.half
  const box: ElectricMeter = { ...meter, place: 'post', u, v: Math.round((face - meter.d / 2 - 0.003) * 1000) / 1000, y: 1.4, side: 'front' } // (to the mm: its back 3 mm off the post)
  const conduitV = round2(face - NETWORK_POST.conduitOff)
  const anchor: [number, number, number] = [u, round2(face - NETWORK_POST.bracket), NETWORK_POST.anchor]
  const descent: [number, number, number][] = [[u, conduitV, round2(NETWORK_POST.anchor - 0.1)], [u, conduitV, round2(box.y + box.h / 2)]]
  return { street: 'network', pole: { u, v, h: NETWORK_POST.h }, drop: [anchor], meter: box, descent, internalRun: null }
}

/** On a network a building with no front yard takes the drop on a mast (pontalete) up its facade, clear of the wall, as high as on a post: the descent is the mast. */
function mastEntrance(meter: ElectricMeter): NonNullable<Layout['electrical']['serviceEntrance']> {
  const mast = { u: meter.u, v: round2(meter.v - MAST_OFF_WALL), y0: round2(meter.y + meter.h / 2), y1: round2(NETWORK_POST.anchor + MAST_OVER_ANCHOR) }
  const top: [number, number, number] = [mast.u, mast.v, NETWORK_POST.anchor]
  return { street: 'network', pole: null, mast, drop: [top], meter, descent: [[mast.u, mast.v, mast.y1], [mast.u, mast.v, mast.y0]], internalRun: null }
}

/**
 * On a street whose power runs underground the service lateral comes up from the ground into the meter box where the house has it, low on the
 * gate pillar (or the facade): no post, no mast, no drop. `drop[0]` is the lateral's end at the ground under the box, and the descent the
 * conduit from the ground up into it.
 */
function undergroundEntrance(meter: ElectricMeter): NonNullable<Layout['electrical']['serviceEntrance']> {
  const bottom = round2(meter.y - meter.h / 2)
  return { street: 'network_underground', pole: null, drop: [[meter.u, meter.v, 0]], meter, descent: [[meter.u, meter.v, bottom], [meter.u, meter.v, 0]], internalRun: null }
}

/** The street brings the poles (or its network brings the power under the ground): only the house's own entrance stands in the lot. */
const fromStreet = (layout: Layout): boolean => layout.streetPoles === true || networkStreetOf(layout.street) !== undefined

/** Height of the panel over the floor, metres. */
const PANEL_HEIGHT = 1.5
/** How far the panel's centre keeps from a window's side: its envelope with the door open, the 15 cm a curtain or blind hangs past the window, and a gap. */
const PANEL_WINDOW_CLEARANCE = 0.7
/** The clearance from a window the Visor de casas 3D kept (`visor`, the team's golden only). */
const VISOR_PANEL_WINDOW_CLEARANCE = 0.3

/** The distribution panel in the room of the main door, on the wall nearest the meter, clear of doors and windows and of tall furniture. */
export function placePanel(layout: Layout): void {
  const { plan, rooms, electrical, pointsOf } = layout
  const door = mainDoorOf(plan)
  const room = (door && rooms.find((c) => c.id === door.a && c.floor === 0)) || rooms.find((c) => c.floor === 0) || rooms[0]
  if (!room) return
  const meter = electrical.serviceEntrance?.meter
  const targetU = meter ? meter.u : plan.w / 2
  const targetV = meter ? Math.max(0, meter.v) : 0
  // the panel and the sweep of its door keep clear of what hangs on the wall (pictures, curtains past the window's sides) and of the sockets
  const taken = wallItemBoxesOf(layout.items, room.floor).concat(electrical.outlets.filter((t) => t.floor === room.floor).map((t) => plateBox(t, t.y)))
  // (the Visor de casas 3D kept only 30 cm from a window and looked at nothing else on the wall: its golden keeps that)
  const free = (point: WallPoint): boolean => !!layout.visor || !taken.some((box) => clashes(box, panelBox(spotOf(point), PANEL_HEIGHT)))
  const windowClearance = layout.visor ? VISOR_PANEL_WINDOW_CLEARANCE : PANEL_WINDOW_CLEARANCE
  let best: { point: WallPoint | undefined; score: number } | null = null
  for (const point of pointsOf.get(keyOf(room)) ?? []) {
    if (point.blocked(1.5) || hasWindowAt(point, PANEL_HEIGHT, windowClearance) || atDoor(plan, room, point, 0.8) || !free(point)) continue
    const score = Math.hypot(point.u - targetU, point.v - targetV) + (point.exterior ? 0 : 3)
    if (!best || score < best.score) best = { point, score }
  }
  if (!best) best = { point: (pointsOf.get(keyOf(room)) ?? [])[0], score: 0 }
  if (best.point) {
    const p = best.point
    electrical.panel = { id: 'panel', room: room.id, floor: room.floor, u: p.u, v: p.v, y: PANEL_HEIGHT, c: p.c, axis: p.axis, pos: p.pos, frontU: p.nu, frontV: p.nv, w: 0.3, h: 0.4, breakers: 0 }
  }
  if (electrical.serviceEntrance && electrical.panel) {
    const entrance = electrical.serviceEntrance
    const meterOf = entrance.meter as ElectricMeter // placeEntrance always sets the meter; only the tap pass clears it, later
    entrance.internalRun = [[meterOf.u, meterOf.v, 0.1], [electrical.panel.u, electrical.panel.v, heightOf(plan, electrical.panel.floor, electrical.panel.y)]]
  }
}
