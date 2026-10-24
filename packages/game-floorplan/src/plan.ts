import { CAR_CLEARANCE, DOOR_EDGE_CLEARANCE, MARGIN, PLAYER_RADIUS, TOL, WALL_THICKNESS, WINDOWLESS_ROOM_TYPES, WINDOW_EDGE_CLEARANCE } from './constants'
import { buildWalls, clamp, eq, exteriorEdge, inRect, normalizeRoom, openingDepth, openingZones, r2, sharedEdge } from './geometry'
import { STREAM } from './legacy-seeds'
import { createRng, pickWeighted } from './rng'
import { STYLES, WALL_TOP_HEIGHTS, resolveStyleId, styleOf } from './registry'
import { addExteriorDoorPaths } from './paths'
import { clampLotToZone, enforcePermeability } from './zoning'
import type { FloorDef, FloorplanOptions, Json, LotConfig, Plan, Rect, Room, StyleDef, TemplateDef, WindowDef, ZoneAdjustment, ZoneDef } from './types'

export const floorsOf = (tpl: TemplateDef, op?: FloorplanOptions): FloorDef[] => (tpl.floorsFn ? tpl.floorsFn(op || {}) : (tpl.floors as FloorDef[]))

export function clampSize(tpl: TemplateDef, w: number | undefined, d: number | undefined, op?: FloorplanOptions) {
  const L = tpl.limitsFn ? tpl.limitsFn(op || {}) : tpl.limits
  const P0 = tpl.defaultsFn ? tpl.defaultsFn(op || {}) : tpl.defaults
  const ww = w == null ? P0.w : clamp(w, L.w[0], L.w[1])
  const dd = d == null ? P0.d : clamp(d, L.d[0], L.d[1])
  return { w: r2(ww), d: r2(dd) }
}

export interface BuildContext {
  zone?: ZoneDef | null
  adjustments?: ZoneAdjustment[]
}

export function buildPlan(tpl: TemplateDef, wIn: number | undefined, dIn: number | undefined, opIn?: FloorplanOptions, bc: BuildContext = {}): Plan {
  const op = opIn || {}
  const { w, d } = clampSize(tpl, wIn, dIn, op)
  const styleId = resolveStyleId(op.style || (typeof tpl.style === 'function' ? tpl.style(op) : tpl.style) || 'budget')
  const FLOOR_DEFS = floorsOf(tpl, op)
  const style = styleOf(styleId)
  const plan: Plan = {
    w, d, tpl, floorDefs: FLOOR_DEFS, style: styleId, floors: [], rooms: [], zones: [], doors: [], windows: [], walls: [], gates: [], paths: [], lot: null, openPairs: {}, reservations: [],
    playerRadius: op.playerRadius ?? PLAYER_RADIUS,
    carClearance: Object.assign({}, CAR_CLEARANCE, op.carClearance),
  }
  FLOOR_DEFS.forEach((A, floorIndex) => {
    const floorNumber = tpl.singleFloor ? op.floor || 3 : floorIndex + 1
    plan.floors.push({
      index: floorIndex,
      name: tpl.singleFloor ? 'floor_n' : A.label,
      number: tpl.singleFloor ? floorNumber : undefined,
      y0: tpl.singleFloor ? (floorNumber - 1) * A.ceiling : tpl.cumulativeCeilings ? FLOOR_DEFS.slice(0, floorIndex).reduce((t, q) => t + q.ceiling, 0) : floorIndex * A.ceiling,
      ceiling: A.ceiling,
    })
    plan.openPairs[floorIndex] = A.openPairs || []
    const list = A.rooms(w, d, op).map((c) => normalizeRoom(c, floorIndex))
    for (const c of list) {
      if (plan.rooms.some((x) => x.id === c.id)) throw new Error('Duplicate room: ' + c.id)
      plan.rooms.push(c)
    }
    const byId: Record<string, Room> = {}
    for (const c of list) byId[c.id] = c
    const floorDoors: Json[] = []
    ;(A.doors(w, d, op) || []).forEach((sp, i) => {
      const a = byId[sp.a]
      if (!a) throw new Error('Door references a missing room: ' + sp.a)
      let edge
      if (sp.edge) edge = sp.edge
      else if (sp.b === 'outside') edge = exteriorEdge(a, sp.side as string, w, d, sp.at)
      else {
        const b = byId[sp.b]
        if (!b) throw new Error('Door references a missing room: ' + sp.b)
        edge = sharedEdge(a, b, sp.at)
      }
      if (!edge) throw new Error('Door without a wall: ' + sp.a + ' / ' + sp.b)
      const width = sp.width
      const margin = width / 2 + (sp.clearance ?? tpl.clearance?.door ?? DOOR_EDGE_CLEARANCE)
      if (edge.a1 - edge.a0 < width + 0.24) throw new Error('Wall too short for the door: ' + sp.a + ' / ' + sp.b)
      const c = clamp(sp.at != null ? sp.at : (edge.a0 + edge.a1) / 2, edge.a0 + margin, edge.a1 - margin)
      const exterior = sp.b === 'outside'
      const leaf = exterior && sp.steel ? 0 : width > 1.1 ? width / 2 : width
      const u = edge.axis === 'u' ? c : edge.pos
      const v = edge.axis === 'u' ? edge.pos : c
      floorDoors.push({
        id: 'd' + floorIndex + '_' + i,
        floor: floorIndex,
        u: r2(u),
        v: r2(v),
        axis: edge.axis,
        pos: edge.pos,
        at: r2(c),
        width,
        a: sp.a,
        b: sp.b,
        opensTo: sp.opensTo || sp.a,
        exterior,
        side: sp.side || null,
        leaves: exterior && sp.steel ? 0 : width > 1.1 ? 2 : 1,
        model: sp.model || (sp.steel ? 'steel' : width > 1.1 ? 'double' : 'single'),
        type: sp.type || 'door',
        steps: sp.steps || 0,
        hinge: 'start',
        zones: openingZones(u, v, edge.axis, width, openingDepth(width, leaf)),
      })
    })
    plan.doors.push(...floorDoors)
    const floorWalls = (tpl.noWalls ? [] : buildWalls(list, floorDoors, A.openPairs || [], floorIndex)).map((p) => Object.assign(p, { h: p.h || A.ceiling }))
    const windowsOut = placeWindows({ list, byId, floorWalls, windowDefs: A.windows(w, d, op) || [], floorIndex, ceiling: A.ceiling, w, d, clearance: tpl.clearance?.window ?? WINDOW_EDGE_CLEARANCE })
    plan.windows.push(...windowsOut)
    plan.walls.push(...floorWalls)
  })
  if (tpl.reservations) tpl.reservations(plan)
  buildLot(plan, tpl, w, d, op, style, styleId, bc)
  return plan
}

interface WindowGroup {
  wall: Json
  edge: { axis: 'u' | 'v'; pos: number }
  start: number
  end: number
  def: Json
  entries: { def: Json; centre: number; order: number }[]
}
interface WindowParams {
  list: Room[]
  byId: Record<string, Room>
  floorWalls: Json[]
  windowDefs: WindowDef[]
  floorIndex: number
  ceiling: number
  w: number
  d: number
  clearance: number
}

/**
 * Each window lands on a stretch of exterior wall (between corners, junctions and doors) and is spread over it: a single window is centred,
 * several get equal gaps, and none comes closer than `clearance` to a corner, a junction or a door. A room that needs light but got no window gets one.
 */
function placeWindows(params: WindowParams): Json[] {
  const { list, byId, floorWalls, windowDefs, floorIndex, ceiling, w, d, clearance } = params
  const stretches = floorWalls.filter((p) => p.exterior && p.type === 'wall')
  const found: Json[] = []
  const groups: WindowGroup[] = []
  let order = 0
  for (const def of windowDefs) {
    const room = byId[def.room]
    if (!room) throw new Error('Window references a missing room: ' + def.room)
    const edge = exteriorEdge(room, def.side, w, d, def.at)
    if (!edge) continue
    const centres = def.n ? Array.from({ length: def.n }, (_, i) => edge.a0 + ((edge.a1 - edge.a0) * (i + 1)) / (def.n! + 1)) : [def.at as number]
    for (const centre of centres) {
      const onEdge = stretches.filter((t) => t.axis === edge.axis && eq(edge.axis === 'u' ? t.v0 : t.u0, edge.pos) && t.sides.includes(def.room))
      const start = (t: Json) => (edge.axis === 'u' ? t.u0 : t.v0)
      const end = (t: Json) => (edge.axis === 'u' ? t.u1 : t.v1)
      const gap = (t: Json) => Math.min(Math.abs(centre - start(t)), Math.abs(centre - end(t)))
      const target = onEdge.find((t) => centre >= start(t) - TOL && centre <= end(t) + TOL) || onEdge.slice().sort((x, y) => gap(x) - gap(y))[0]
      if (!target) continue
      let group = groups.find((x) => x.wall === target && x.def.room === def.room)
      if (!group) groups.push((group = { wall: target, edge, start: start(target), end: end(target), def, entries: [] }))
      group.entries.push({ def, centre, order: order++ })
    }
  }
  for (const g of groups) {
    const room = byId[g.def.room]
    const bath = room.type === 'bathroom'
    const length = g.end - g.start
    const its = g.entries
      .slice()
      .sort((x, y) => x.centre - y.centre)
      .map((x) => ({ def: x.def, order: x.order, width: bath ? Math.min(x.def.width, 0.6) : x.def.width }))
    const fits = (l: typeof its) => l.reduce((t, x) => t + x.width, 0) + (l.length + 1) * clearance <= length + TOL
    while (its.length && !fits(its)) {
      const k = its.reduce((m, x, i, arr) => (x.width > arr[m].width ? i : m), 0)
      if (its[k].width > 0.6 + TOL) its[k] = Object.assign({}, its[k], { width: Math.max(0.6, r2(its[k].width - 0.1)) })
      else its.pop()
    }
    if (!its.length) continue
    const space = (length - its.reduce((t, x) => t + x.width, 0)) / (its.length + 1)
    let pos = g.start + space
    for (const x of its) {
      const c = pos + x.width / 2
      pos += x.width + space
      const u = g.edge.axis === 'u' ? c : g.edge.pos
      const v = g.edge.axis === 'u' ? g.edge.pos : c
      let y0 = x.def.y0 || 1.0
      let y1 = x.def.y1 || 2.15
      if (bath) {
        y0 = Math.max(y0, 2.1)
        y1 = Math.min(Math.max(y1, y0 + 0.4), ceiling - 0.25)
      }
      found.push({ id: '', floor: floorIndex, u: r2(u), v: r2(v), axis: g.edge.axis, pos: g.edge.pos, at: r2(c), width: x.width, y0: r2(y0), y1: r2(y1), room: x.def.room, side: x.def.side, _order: x.order })
    }
  }
  for (const room of list) {
    if (WINDOWLESS_ROOM_TYPES.has(room.type) || found.some((j) => j.room === room.id)) continue
    let best: { length: number; window: Json } | null = null
    for (const t of stretches) {
      if (!t.sides.includes(room.id)) continue
      const i0 = t.axis === 'u' ? t.u0 : t.v0
      const i1 = t.axis === 'u' ? t.u1 : t.v1
      const length = i1 - i0
      const width = Math.min(room.type === 'bathroom' ? 0.6 : 1.2, length - 2 * clearance)
      if (width < 0.6 - TOL || (best && best.length >= length)) continue
      const side = t.axis === 'u' ? (t.sides[0] === 'outside' ? 'front' : 'back') : t.sides[0] === 'outside' ? 'left' : 'right'
      const c = (i0 + i1) / 2
      const pos = t.axis === 'u' ? t.v0 : t.u0
      const bath = room.type === 'bathroom'
      best = { length, window: { id: '', floor: floorIndex, u: r2(t.axis === 'u' ? c : pos), v: r2(t.axis === 'u' ? pos : c), axis: t.axis, pos, at: r2(c), width: r2(width), y0: bath ? 2.1 : 1.0, y1: bath ? Math.min(2.5, ceiling - 0.25) : 2.15, room: room.id, side, _order: 1e6 + found.length } }
    }
    if (best) found.push(best.window)
  }
  found.sort((x, y) => x._order - y._order)
  found.forEach((j, i) => {
    delete j._order
    j.id = 'w' + floorIndex + '_' + i
  })
  return found
}

/** Facade and lot: zones, gates, paths and perimeter. */
function buildLot(plan: Plan, tpl: TemplateDef, w: number, d: number, op: FloorplanOptions, style: StyleDef, styleId: string, bc: BuildContext) {
  const seed = op.seed == null ? 1 : op.seed
  const rFacade = createRng(seed, STREAM.facade)
  const facadeStyle = style.facade
  const palette = style.swatches
  const color = palette[Math.floor(rFacade() * palette.length)]
  const extra = tpl.facade || {}
  plan.facade = {
    style: styleId,
    color: { name: color[0], hex: color[1] },
    finish: pickWeighted(rFacade, facadeStyle.finish),
    grilles: rFacade() < facadeStyle.grilles,
    roof: pickWeighted(rFacade, facadeStyle.roof),
    balcony: !!extra.balcony,
    veranda: !!extra.veranda,
    steelDoor: !!extra.steelDoor,
    floors: plan.floorDefs.length,
  }
  if (tpl.facadeExtra) tpl.facadeExtra(plan.facade, rFacade, w, d, op)
  if (plan.floorDefs.length > 1 && plan.facade.roof === 'fiber_cement') plan.facade.roof = 'colonial'
  if (!tpl.lot) return
  const cfg: LotConfig = tpl.lot(w, d, style, op)
  if (bc.zone) clampLotToZone(cfg, bc.zone, bc.adjustments || [], tpl.partyWalls)
  const rLot = createRng(seed, STREAM.lot)
  const setback = cfg.frontSetback
  const marginL = cfg.marginLeft
  const marginR = cfg.marginRight
  const backDepth = cfg.backyardDepth
  const lot: Json = {
    rect: [-marginL, -setback, w + marginR, d + backDepth],
    setback,
    sideYard: { left: marginL, right: marginR },
    backyard: backDepth,
    style: styleId,
    zones: [],
    perimeter: [],
    gates: [],
    paths: [],
    pool: !!cfg.pool,
  }
  const ZONES: Room[] = []
  const libs = Object.assign({ garden: 'garden', backyard: 'backyard', parking: 'parking', sideYard: 'side_yard' }, cfg.libraries || {})
  const addZone = (id: string, type: string, label: string, parts: Rect[], library?: string) =>
    ZONES.push(Object.assign(normalizeRoom({ id, type, label, rect: parts[0], parts: parts.slice(1), library, outdoor: true }, -1), { floor: -1, outdoor: true }))
  if (setback > 0) {
    let parts: Rect[] = [[-marginL, -setback, w + marginR, 0]]
    if (cfg.parking) {
      const garageU = (cfg.garage as Json).u
      const vw = cfg.parking.width
      const x0 = Math.max(-marginL, garageU - vw / 2)
      const x1 = Math.min(w + marginR, garageU + vw / 2)
      parts = []
      if (x0 + marginL > 0.8) parts.push([-marginL, -setback, x0, 0])
      if (w + marginR - x1 > 0.8) parts.push([x1, -setback, w + marginR, 0])
      addZone('parking', 'parking', 'parking', [[x0, -setback, x1, 0]], libs.parking)
      if (!parts.length) parts = [[x1, -setback, w + marginR, 0]]
    }
    parts.sort((a, b) => b[2] - b[0] - (a[2] - a[0]))
    addZone('garden', 'garden', 'garden', parts, libs.garden)
  }
  const yard = cfg.yardZones
  if (backDepth > 0 && yard) {
    for (const q of yard) addZone(q.id, q.type, q.label || q.id, [[-marginL, d + q.v0, w + marginR, d + Math.min(backDepth, q.v1)]], q.library)
  } else if (backDepth > 0) addZone('backyard', 'backyard', 'backyard', [[-marginL, d, w + marginR, d + backDepth]], libs.backyard)
  for (const q of cfg.extraZones || []) addZone(q.id, q.type, q.label || q.id, q.parts, q.library)
  if (marginL > 0.5) addZone('side_left', 'side_yard', 'side_left', [[-marginL, 0, 0, d]], libs.sideYard)
  if (marginR > 0.5) addZone('side_right', 'side_yard', 'side_right', [[w, 0, w + marginR, d]], libs.sideYard)
  const gates: Json[] = []
  const addGate = (type: string, model: string, u: number, v: number, width: number, side: string, toTarget?: string | null) => {
    const g: Json = {
      id: 'g' + gates.length,
      type,
      model,
      u: r2(u),
      v: r2(v),
      axis: 'u',
      width,
      height: type === 'pedestrian' ? style.height : Math.min(style.height, 2.2),
      side,
      to: toTarget || null,
      material: 'iron',
    }
    g.zones = openingZones(u, v, 'u', width, openingDepth(width, type === 'pedestrian' ? width : 0))
    gates.push(g)
    return g
  }
  if (cfg.pedestrian && setback > 0) addGate('pedestrian', 'pedestrian', cfg.pedestrian.u, -setback, 1.0, 'front', 'door')
  if (cfg.garage && setback > 0) addGate('garage', pickWeighted(rLot, style.gate.garage), cfg.garage.u, -setback, cfg.garage.width, 'front', cfg.garage.to)
  if (cfg.cargo) addGate('cargo', 'sliding', cfg.cargo.u, d + backDepth, cfg.cargo.width, 'back', 'stockroom')
  plan.gates = gates
  lot.gates = gates
  const paths: Json[] = []
  const target = (a: string, side: string) => plan.doors.find((p) => p.exterior && p.a === a && p.side === side)
  for (const g of gates) {
    if (g.type === 'pedestrian' && cfg.doorTarget) {
      const pt = target(cfg.doorTarget.a, cfg.doorTarget.side)
      if (!pt) continue
      const gateU = g.u
      const dx = pt.u
      const ym = -setback / 2
      const L = 1.0
      const h = L / 2
      const rs: Rect[] = []
      if (Math.abs(gateU - dx) < 0.05) rs.push([dx - h, -setback, dx + h, 0])
      else {
        rs.push([gateU - h, -setback, gateU + h, ym + h])
        rs.push([Math.min(gateU, dx) - h, ym - h, Math.max(gateU, dx) + h, ym + h])
        rs.push([dx - h, ym - h, dx + h, 0])
      }
      paths.push({ id: 'pedestrian_path', type: 'pedestrian', from: g.id, to: pt.id, width: L, rects: rs.map((r) => r.map(r2)), points: [[gateU, -setback], [gateU, ym], [dx, ym], [dx, 0]] })
    } else if (g.type === 'garage' && g.to === 'inner_garage') {
      const pt = plan.doors.find((p) => p.exterior && p.side === 'front' && Math.abs(p.u - g.u) < 0.6 && p.width >= 2.5)
      if (!pt) continue
      const hw = Math.max(g.width, pt.width) / 2
      paths.push({ id: 'garage_path', type: 'vehicle', from: g.id, to: pt.id, width: hw * 2, rects: [[g.u - hw, -setback, g.u + hw, 0].map(r2)], points: [[g.u, -setback], [g.u, 0]] })
    } else if (g.type === 'cargo') {
      const pt = target('stockroom', 'back')
      if (!pt) continue
      const hw = Math.max(g.width, pt.width) / 2
      paths.push({ id: 'cargo_path', type: 'vehicle', from: g.id, to: pt.id, width: hw * 2, rects: [[g.u - hw, d, g.u + hw, d + backDepth].map(r2)], points: [[g.u, d + backDepth], [g.u, d]] })
    }
  }
  if (tpl.paths) paths.push(...tpl.paths(plan, { gates, setback, marginLeft: marginL, marginRight: marginR, backyard: backDepth, w, d }))
  else addExteriorDoorPaths(plan, { gates, paths, zones: ZONES, setback, marginLeft: marginL, marginRight: marginR, backyard: backDepth, w, target: cfg.doorTarget })
  plan.paths = paths
  lot.paths = paths
  const boundary = (rule: { type: Record<string, number>; top: Record<string, number> }) => {
    const type = pickWeighted(rLot, rule.type)
    const top = type === 'railing' ? 'none' : pickWeighted(rLot, rule.top)
    const wallHeight = type === 'railing' ? 1.2 : type === 'fence' ? (style.fenceHeight ?? 2.0) : style.height
    return { type, material: type === 'wall' ? 'block' : type === 'fence' ? 'wire_mesh' : 'iron', height: wallHeight, top, totalHeight: r2(wallHeight + WALL_TOP_HEIGHTS[top]), thickness: WALL_THICKNESS }
  }
  const A: Record<string, Json> = { front: boundary(style.front), left: boundary(style.sideYard), right: boundary(style.sideYard), back: boundary(style.back) }
  const seg = (side: string, u0: number, v0: number, u1: number, v1: number) => {
    if (Math.abs(u1 - u0) + Math.abs(v1 - v0) < 0.05) return
    lot.perimeter.push(Object.assign({ id: 'm' + lot.perimeter.length, side, u0: r2(u0), v0: r2(v0), u1: r2(u1), v1: r2(v1) }, A[side]))
  }
  const cutRun = (side: string, de: number, to: number, vfix: number, gs: Json[]) => {
    let pieces: [number, number][] = [[de, to]]
    for (const g of gs) {
      const g0 = g.u - g.width / 2
      const g1 = g.u + g.width / 2
      const n: [number, number][] = []
      for (const [x, y] of pieces) {
        if (g1 <= x || g0 >= y) {
          n.push([x, y])
          continue
        }
        if (g0 > x) n.push([x, g0])
        if (g1 < y) n.push([g1, y])
      }
      pieces = n
    }
    for (const [x, y] of pieces) seg(side, x, vfix, y, vfix)
  }
  if (setback > 0)
    cutRun('front', -marginL, w + marginR, -setback, gates.filter((g) => g.side === 'front'))
  cutRun('back', -marginL, w + marginR, d + backDepth, gates.filter((g) => g.side === 'back'))
  const vi = setback > 0 ? -setback : 0
  if (marginL > 0.5) seg('left', -marginL, vi, -marginL, d + backDepth)
  else if (backDepth > 0) seg('left', 0, d, 0, d + backDepth)
  if (marginR > 0.5) seg('right', w + marginR, vi, w + marginR, d + backDepth)
  else if (backDepth > 0) seg('right', w, d, w, d + backDepth)
  for (const z of ZONES) z.ground = (cfg.grounds || {})[z.id] || (cfg.grounds || {})[z.type] || pickWeighted(rLot, style.grounds[z.type] || { concrete: 1 })
  if (bc.zone) enforcePermeability(lot, ZONES, bc.zone, bc.adjustments || [])
  plan.zones = ZONES
  lot.zones = ZONES
  plan.lot = lot
}

export { inRect, MARGIN, STYLES }
