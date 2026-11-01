import { MARGIN, EPS } from './constants'
import {
  areaOf,
  clamp,
  clearRect,
  cutIntervals,
  extent,
  inflate,
  inner,
  insideUnion,
  overlaps,
  r2,
  topOf,
  usableParts,
} from './geometry'
import { rotationFor } from './fill'
import { createGrid, reachable } from './grid'
import { STREAM } from './legacy-seeds'
import { blocksWindow, roomAt, windowZone, windowsOfRoom, zonesOfFloor } from './queries'
import { registries } from './registry'
import { createRng, pickWeighted, shuffle } from './rng'
import type { Rng } from './rng'
import type { Json, PlacedItem, Plan, PlacementContext, PlacementKit, Rect, Room, Vec2 } from './types'

/** Geometry and grid helpers shared with decor passes and state plugins. */
export const placementKit: PlacementKit = {
  MARGIN,
  EPS,
  r2,
  clamp,
  overlaps,
  inner,
  inflate,
  areaOf,
  topOf,
  extent,
  insideUnion,
  usableParts,
  zonesOfFloor,
  windowsOfRoom,
  windowZone,
  roomAt,
  reachable: reachable as PlacementKit['reachable'],
  createGrid: createGrid as PlacementKit['createGrid'],
  clearRect,
  pickWeighted,
  createRng,
  roomSeedKey: (room: Room) => room.seedKey ?? registries().SEED_KEYS.rooms[room.id] ?? room.id,
  shuffle,
  facingRotation: (f: Vec2, type: string) => rotationFor(f, registries().CATALOG[type].front),
  cutIntervals,
  blocksWindow,
}

/** Builds the shared placement context over the items already placed by the slot fill. */
export function createPlacementContext(plan: Plan, items: PlacedItem[]): PlacementContext {
  const added: PlacedItem[] = []
  const counters: Record<string, number> = {}
  const make = (room: Room, type: string, r: Rect, f: Vec2, o?: Json): PlacedItem => {
    const it = registries().CATALOG[type]
    const n = (counters[room.id + type] = (counters[room.id + type] || 0) + 1)
    return Object.assign(
      {
        id: room.id + '.dec_' + type + n,
        type,
        category: it.category,
        x: r2((r[0] + r[2]) / 2),
        z: r2((r[1] + r[3]) / 2),
        ry: r2(Math.atan2(f[0], f[1])),
        w: it.w,
        d: it.d,
        h: it.h,
        y: 0,
        frontU: f[0],
        frontV: f[1],
        room: room.id,
        floor: room.floor,
        outdoor: !!room.outdoor,
        slot: 'dec_' + type + n,
        on: null,
        mode: null,
        clearance: 0,
        flat: !!it.flat,
        low: it.low,
        aabb: r.map(r2),
        _r: r,
        decor: true,
        mount: it.mount,
      },
      o || {},
    ) as PlacedItem
  }
  const add = (m: PlacedItem) => {
    added.push(m)
    items.push(m)
    return m
  }
  const itemsOfRoom = (c: Room) => items.filter((m) => m.room === c.id && m.floor === c.floor)
  const extraSolids: Record<string, Rect[]> = {}
  const solidsOfRoom = (c: Room): Rect[] =>
    itemsOfRoom(c)
      .filter((m) => !m.flat && !m.on && (!m.decor || m.mount === 'floor'))
      .map((m) => m._r as Rect)
      .concat(extraSolids[c.id] || [])
  const gridCache: Record<string, ReturnType<typeof createGrid>> = {}
  let ignored: Set<string> | null = null
  const gridOf = (c: Room) => gridCache[c.id] || (gridCache[c.id] = createGrid(plan, c, ignored))

  /** Places a floor item at a corner or along a wall; respects doors, windows, clearances and walkability. */
  function placeOnFloor(room: Room, type: string, rng2: Rng, optsIn?: Json): Rect | null {
    const opts = Object.assign({}, optsIn || {})
    const it0 = registries().CATALOG[type]
    if (it0.flat) opts.flat = true
    const it = registries().CATALOG[type]
    const inners = usableParts(room, 0)
    const solidList = solidsOfRoom(room)
    const zones = zonesOfFloor(plan, room.floor)
    const occupied = itemsOfRoom(room)
    const windowZones = windowsOfRoom(plan, room).map((j) => ({ z: windowZone(j, room.outdoor), j }))
    // the 1 m landing in front of a staircase stays free
    const landings: Rect[] = it0.flat
      ? []
      : items
          .filter((m) => m.type === 'stairs' && m.floor === room.floor && m.aabb)
          .map((m) => {
            const r = m.aabb
            return (m.frontV === 1 ? [r[0], r[3], r[2], r[3] + 1] : m.frontV === -1 ? [r[0], r[1] - 1, r[2], r[1]] : m.frontU === 1 ? [r[2], r[1], r[2] + 1, r[3]] : [r[0] - 1, r[1], r[0], r[3]]) as Rect
          })
    const cand: Rect[] = opts.cands ? opts.cands.slice() : []
    if (!opts.cands)
      for (const p of inners) {
        const extentU = opts.dim ? opts.dim[0] : it.w
        const extentV = opts.dim ? opts.dim[1] : it.d
        for (const [x, z] of [[p[0], p[1]], [p[2] - extentU, p[1]], [p[0], p[3] - extentV], [p[2] - extentU, p[3] - extentV]]) cand.push([x, z, x + extentU, z + extentV])
        for (let k = 0; k < 6; k++) {
          const t = rng2()
          const side = Math.floor(rng2() * 4)
          const x = side < 2 ? p[0] + t * Math.max(0, p[2] - p[0] - extentU) : side === 2 ? p[0] : p[2] - extentU
          const z = side >= 2 ? p[1] + t * Math.max(0, p[3] - p[1] - extentV) : side === 0 ? p[1] : p[3] - extentV
          cand.push([x, z, x + extentU, z + extentV])
        }
      }
    for (const r of opts.ordered ? cand : shuffle(cand, rng2)) {
      if (!insideUnion(r, inners)) continue
      if (zones.some((z) => overlaps(r, z)) || landings.some((z) => overlaps(r, z))) continue
      if (windowZones.some(({ z, j }) => blocksWindow(it, j) && overlaps(r, z))) continue
      if (solidList.some((o) => overlaps(r, o))) continue
      if (opts.flat) {
        if (!(opts.without && opts.without(r))) return r
        continue
      }
      if (occupied.some((m) => !m.low && !m.flat && !m.on && !m.decor && m.clearance > 0 && overlaps(r, clearRect(m._r as Rect, [m.frontU, m.frontV], m.clearance)))) continue
      if (opts.without && opts.without(r)) continue
      if (!reachable(opts.railing || gridOf(room), solidList.concat([r]), room.outdoor ? 0.16 : plan.playerRadius)) continue
      return r
    }
    return null
  }
  const roomById = (id: string) => plan.rooms.find((c) => c.id === id) || plan.zones.find((c) => c.id === id)
  return {
    make,
    add,
    placeOnFloor,
    itemsOfRoom,
    solidsOfRoom,
    gridOf,
    extraSolids,
    roomById,
    setIgnored: (s) => {
      ignored = s
      for (const k of Object.keys(gridCache)) delete gridCache[k]
    },
    added,
  }
}

/** Ground cover per lot zone: one piece per zone part, plus overlays registered by content packs (decks around pools...). */
function groundCover(plan: Plan, items: PlacedItem[], ctx: PlacementContext) {
  if (!plan.lot) return
  const polygonOf = (r: Rect) => [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]].map((p) => [r2(p[0]), r2(p[1])])
  const groundPiece = (z: Room, type: string, r: Rect, layer: number, i: number) => {
    const m = ctx.make(z, type, r, [0, 1], {
      id: z.id + '.ground' + (layer ? '_overlay' : '') + i,
      slot: 'ground' + (layer ? '_overlay' : '') + i,
      w: r2(r[2] - r[0]),
      d: r2(r[3] - r[1]),
      h: 0,
      polygon: polygonOf(r),
      layer,
      zone: z.id,
      outdoor: true,
      floor: -1,
    })
    return ctx.add(m)
  }
  for (const z of plan.zones) {
    z.parts.forEach((p, i) => groundPiece(z, z.ground as string, p, 0, i))
    let k = 0
    const clip = (r: Rect): Rect | undefined =>
      z.parts
        .map((p) => [Math.max(r[0], p[0]), Math.max(r[1], p[1]), Math.min(r[2], p[2]), Math.min(r[3], p[3])] as Rect)
        .filter((q) => q[2] - q[0] > 0.3 && q[3] - q[1] > 0.3)
        .sort((a, b) => areaOf(b) - areaOf(a))[0]
    for (const rule of registries().GROUND_OVERLAYS) {
      const triggers = items.filter((m) => m.room === z.id && m.category === rule.category)
      if (rule.merge) {
        if (triggers.length && z.ground !== rule.unlessGround) {
          const u = triggers.reduce((a, m) => [Math.min(a[0], (m._r as Rect)[0]), Math.min(a[1], (m._r as Rect)[1]), Math.max(a[2], (m._r as Rect)[2]), Math.max(a[3], (m._r as Rect)[3])], [1e9, 1e9, -1e9, -1e9])
          const q = clip(inflate(u as Rect, rule.inflate))
          if (q) groundPiece(z, rule.ground, q, 1, k++)
        }
      } else {
        for (const m of triggers) {
          const q = clip(inflate(m._r as Rect, rule.inflate))
          if (q) groundPiece(z, rule.ground, q, 1, k++)
        }
      }
    }
  }
}

/** Runs the registered decor passes and the ground cover; returns the context for the state step. */
export function runPostProcess(plan: Plan, items: PlacedItem[], seed: number | string): PlacementContext {
  const ctx = createPlacementContext(plan, items)
  const rng = createRng(seed, STREAM.decor)
  for (const pass of registries().PASSES) pass.run({ plan, items, seed, rng, ctx, kit: placementKit, catalog: registries().CATALOG, profiles: registries().DECOR_PROFILES })
  groundCover(plan, items, ctx)
  return ctx
}
