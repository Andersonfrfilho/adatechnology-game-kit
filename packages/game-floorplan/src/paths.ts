import { r2 } from './geometry'
import type { Json, Plan, Rect, Room } from './types'

export interface ExteriorPathContext {
  gates: Json[]
  paths: Json[]
  zones: Room[]
  setback: number
  marginLeft: number
  marginRight: number
  backyard: number
  w: number
  /** Door the entrance path is named after (the template's `doorTarget`). */
  target?: { a: string; side: string }
}

const CLOSE = 1e-6
const rounded = (r: Rect): Rect => r.map(r2) as Rect
const touches = (a: Rect, r: Rect): boolean => a[0] <= r[2] + CLOSE && a[2] >= r[0] - CLOSE && a[1] <= r[3] + CLOSE && a[3] >= r[1] - CLOSE

interface SideRoute {
  lane: { x: number; width: number; side: string }
  laneWidth: number
  half: number
  vertical: Rect
  horizontal: Rect | null
  frontStub: Rect | null
  cost: number
  rearStrip: number
  rearY: number
  frontY: number
  overlapsParking: boolean
}

/**
 * Every exterior door of the ground floor gets a paved pedestrian path to the pedestrian gate or to the nearest existing path.
 * Doors on the front go straight out; doors on the back or the sides run along the side yard, to the parking or to the front path.
 */
export function addExteriorDoorPaths(plan: Plan, c: ExteriorPathContext): void {
  const { gates, paths, zones, setback, marginLeft, marginRight, backyard, w } = c
  const social = gates.find((g) => g.type === 'pedestrian')
  const socialPath = social ? paths.find((p) => p.from === social.id && p.type === 'pedestrian') : null
  const parkingZone = zones.find((z) => z.id === 'parking')
  const parking: Rect | null = parkingZone ? parkingZone.parts[0] : null
  const midY = setback > 0 ? -setback / 2 : 0
  const joinToSocial = (x: number, width: number, rects: Rect[], points: number[][]) => {
    if (!socialPath) return
    const h = width / 2
    const horizontal = socialPath.rects.find((r: Rect) => midY >= r[1] - CLOSE && midY <= r[3] + CLOSE && r[2] - r[0] > r[3] - r[1]) || socialPath.rects[0]
    const targetX = x < horizontal[0] ? horizontal[0] + h : x > horizontal[2] ? horizontal[2] - h : x
    if (Math.abs(targetX - x) > CLOSE) {
      rects.push([Math.min(x, targetX) - h, midY - h, Math.max(x, targetX) + h, midY + h])
      points.push([targetX, midY])
    }
  }
  for (const door of plan.doors.filter((q) => q.floor === 0 && q.exterior)) {
    if (paths.some((p) => p.to === door.id)) continue
    const half = Math.max(1.0, Math.min(door.width, 2.0)) / 2
    const rects: Rect[] = []
    const points: number[][] = []
    const isTarget = c.target && door.a === c.target.a && door.side === c.target.side
    let fromId: string | null = social ? social.id : null
    let width = 1.0
    const id = isTarget ? 'entrance_path' : 'path_' + door.id
    if (door.side === 'front') {
      if (setback > 0) {
        const stub = Math.min(1.0, setback)
        rects.push([door.u - half, -stub, door.u + half, 0])
        points.push([door.u, 0], [door.u, -stub])
        if (-stub > midY) {
          rects.push([door.u - width / 2, midY - width / 2, door.u + width / 2, -stub])
          points.push([door.u, midY])
        }
        joinToSocial(door.u, width, rects, points)
      } else {
        rects.push([door.u - half, -1.2, door.u + half, 0])
        points.push([door.u, 0], [door.u, -1.2])
      }
    } else {
      const lanes: SideRoute['lane'][] = []
      if (marginLeft > 0.5) lanes.push({ x: -marginLeft / 2, width: marginLeft, side: 'left' })
      if (marginRight > 0.5) lanes.push({ x: w + marginRight / 2, width: marginRight, side: 'right' })
      const targets: Rect[] = paths.flatMap((p) => p.rects as Rect[]).concat(parking ? [parking] : [])
      let best: SideRoute | null = null
      for (const lane of lanes) {
        if ((door.side === 'left' && lane.side !== 'left') || (door.side === 'right' && lane.side !== 'right')) continue
        const laneWidth = Math.min(0.9, lane.width - 0.1)
        const h = laneWidth / 2
        const rearStrip = Math.min(0.8, backyard)
        const rearY = door.v + rearStrip + laneWidth / 2
        const overlapsParking = !!parking && lane.x + h > parking[0] && lane.x - h < parking[2]
        const frontY = overlapsParking || setback <= 0 ? 0 : -0.6
        let frontStub: Rect | null = null
        if (!overlapsParking && setback > 0) {
          const dir = social && social.u < lane.x ? -1 : 1
          const band = [-0.6 - h, -0.6 + h]
          let nearestX = social ? social.u : lane.x
          let nearestGap = Infinity
          for (const r of targets) {
            if (!(r[1] <= band[1] && r[3] >= band[0])) continue
            const edge = dir < 0 ? r[2] : r[0]
            const gap = Math.abs(edge - lane.x)
            if ((dir < 0 ? edge <= lane.x : edge >= lane.x) && gap < nearestGap) {
              nearestGap = gap
              nearestX = edge
            }
          }
          frontStub = [Math.min(lane.x, nearestX) - (dir < 0 ? 0 : h), -0.6 - h, Math.max(lane.x, nearestX) + (dir < 0 ? h : 0), -0.6 + h]
        }
        const vertical: Rect = [lane.x - h, frontY - (frontY < 0 ? h : 0), lane.x + h, (door.side === 'back' ? rearY : door.v) + laneWidth / 2]
        const horizontal: Rect | null = door.side === 'back' ? [Math.min(door.u, lane.x) - half, rearY - laneWidth / 2, Math.max(door.u, lane.x) + h, rearY + laneWidth / 2] : null
        const cost = (horizontal ? horizontal[2] - horizontal[0] : 0) + (frontStub ? frontStub[2] - frontStub[0] : 0)
        if (!best || cost < best.cost) best = { lane, laneWidth, half: h, vertical, horizontal, frontStub, cost, rearStrip, rearY, frontY, overlapsParking }
      }
      if (best) {
        const { lane, laneWidth, half: h, vertical, horizontal, frontStub, rearStrip, rearY, frontY, overlapsParking } = best
        width = laneWidth
        if (overlapsParking) fromId = (gates.find((g) => g.type === 'garage') || social || ({} as Json)).id || null
        if (door.side === 'back') {
          rects.push([door.u - half, door.v, door.u + half, door.v + rearStrip + laneWidth], horizontal as Rect, vertical)
          points.push([door.u, door.v], [door.u, rearY], [lane.x, rearY], [lane.x, frontY])
        } else {
          const x0 = door.side === 'left' ? lane.x - h : w
          const x1 = door.side === 'left' ? 0 : lane.x + h
          rects.push([Math.min(x0, x1), door.v - half, Math.max(x0, x1), door.v + half], vertical)
          points.push([door.u, door.v], [lane.x, door.v], [lane.x, frontY])
        }
        if (frontStub) {
          rects.push(frontStub)
          points.push([frontStub[0] < lane.x ? frontStub[0] : frontStub[2], -0.6])
        }
      } else {
        const stub = 1.0
        if (door.side === 'back') rects.push([door.u - half, door.v, door.u + half, door.v + Math.min(stub, backyard)])
        else rects.push(door.side === 'left' ? [-Math.min(stub, marginLeft), door.v - half, 0, door.v + half] : [w, door.v - half, w + Math.min(stub, marginRight), door.v + half])
        points.push([door.u, door.v])
      }
    }
    const reached = rects.slice()
    const pool: Rect[] = paths.flatMap((p) => p.rects as Rect[]).concat(parking ? [parking] : [])
    let grows = true
    while (grows) {
      grows = false
      for (const r of pool) {
        if (!reached.includes(r) && reached.some((a) => touches(a, r))) {
          reached.push(r)
          grows = true
        }
      }
    }
    const inside = (g: Json) => reached.some((r) => g.u >= r[0] - CLOSE && g.u <= r[2] + CLOSE && g.v >= r[1] - CLOSE && g.v <= r[3] + CLOSE)
    const gate = gates.find((q) => q.type === 'pedestrian' && inside(q)) || gates.find((q) => q.type !== 'cargo' && inside(q))
    if (gate) fromId = gate.id
    paths.push({ id, type: 'pedestrian', from: fromId, to: door.id, width, rects: rects.map(rounded), points: points.map((q) => q.map(r2)) })
  }
}

