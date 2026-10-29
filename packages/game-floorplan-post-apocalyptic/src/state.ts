import type { PlacedItem, Rect, Room, StateContext, StatePlugin, Vec2 } from '@adatechnology/game-floorplan'
import { LEGACY_STREAMS, legacyCarId } from './legacy-seeds'

type Item = PlacedItem & Record<string, any>  

const HEAVY_CATEGORIES = new Set(['sofa', 'wardrobe', 'wardrobe_large', 'fridge', 'shelf_unit', 'tv_unit', 'buffet', 'china_cabinet', 'pantry', 'bookcase', 'dining_table_large', 'freezer', 'wall_shelving'])
const CONTAINER_CATEGORIES = new Set(['dresser', 'nightstand', 'wardrobe', 'wardrobe_large', 'vanity_table', 'sideboard', 'console_table', 'buffet', 'china_cabinet', 'pantry', 'shelf_unit', 'laundry_shelf', 'laundry_cabinet', 'kitchen_cabinet'])
const SUPPORT_CATEGORIES = new Set(['coffee_table', 'sideboard', 'console_table', 'tv_unit', 'dining_table', 'dining_table_large', 'dresser', 'nightstand', 'buffet', 'desk', 'office_desk', 'bench'])
// barricade shifts along the wall
const SHIFTS = [0]
for (let k = 1; k <= 14; k++) SHIFTS.push(k * 0.1, -k * 0.1)

const NORMALS: Record<string, Vec2> = { front: [0, 1], back: [0, -1], left: [1, 0], right: [-1, 0] }

/** Shared toolbox of both states: placement helpers over the engine context. */
function toolbox(c: StateContext) {
  const { plan, items, rng, ctx, kit, catalog: CATALOG } = c
  const { r2, MARGIN, shuffle } = kit
  const { make, placeOnFloor, itemsOfRoom, extraSolids, roomById } = ctx
  const out: Item[] = []
  let counter = 0
  const nextId = (type: string) => 'state.' + ++counter + '.' + type
  /** Registers a state item (geometry in the same format as the furniture). */
  const register = (m: Item, extra?: Record<string, unknown>): Item => {
    const e: Item = Object.assign({}, m, extra || {}, { id: nextId(m.type), state: c.state, stateItem: true })
    delete e.decor
    delete e.polygon
    e._r = m._r
    out.push(e)
    return e
  }
  const addSolid = (room: Room, r: Rect) => {
    ;(extraSolids[room.id] = extraSolids[room.id] || []).push(r)
  }
  const placeItem = (room: Room, type: string, o?: Record<string, any>, extra?: Record<string, unknown>) => {  
    const r = placeOnFloor(room, type, rng, o || {})
    if (!r) return null
    const it = CATALOG[type]
    const f: Vec2 = (o && o.f) || [0, 1]
    const m = make(room, type, r, f, Object.assign({ mount: it.flat ? 'ground' : 'floor' }, extra || {}))
    if (!it.flat) addSolid(room, r)
    return register(m)
  }
  /** Places `n` items in random rooms, retrying when they do not fit. */
  const placeMany = (rooms: Room[], type: string, o: Record<string, any>, n: number) => {  
    let ok = 0
    const L = shuffle(rooms, rng)
    for (let t = 0; t < L.length * 3 && ok < n; t++) if (placeItem(L[t % L.length], type, o)) ok++
    return ok
  }
  const exteriorDoors = plan.doors.filter((p) => p.floor === 0 && p.exterior)
  const groundFloorRooms = plan.rooms.filter((r) => r.floor === 0)
  const campZones = plan.zones.filter((z) => z.type === 'camp')
  return { plan, items, rng, ctx, kit, CATALOG, r2, MARGIN, make, placeOnFloor, itemsOfRoom, extraSolids, roomById, out, nextId, register, addSolid, placeItem, placeMany, exteriorDoors, groundFloorRooms, campZones, counter: () => counter, bump: () => ++counter }
}

function fortified(c: StateContext): PlacedItem[] {
  const t = toolbox(c)
  const { plan, items, rng, ctx, kit, CATALOG, r2, MARGIN, make, placeOnFloor, itemsOfRoom, extraSolids, roomById, out, register, addSolid, placeMany, exteriorDoors, groundFloorRooms, campZones } = t
  const { insideUnion, overlaps, usableParts, reachable, extent, roomAt, shuffle, facingRotation, topOf } = kit
  // boards on windows
  let boarded = 0
  for (const j of plan.windows) {
    if (rng() >= (j.floor === 0 ? 0.92 : 0.5) && !(j === plan.windows[plan.windows.length - 1] && !boarded)) continue // at least one window is boarded
    boarded++
    const room = roomById(j.room)
    if (!room) continue
    const n = NORMALS[j.side]
    const w = r2(j.width + 0.1)
    const d = 0.08
    const cc = j.axis === 'u' ? [j.u, j.v + n[1] * (MARGIN + 0.1 + d / 2)] : [j.u + n[0] * (MARGIN + 0.1 + d / 2), j.v]
    const r: Rect = j.axis === 'u' ? [cc[0] - w / 2, cc[1] - d / 2, cc[0] + w / 2, cc[1] + d / 2] : [cc[0] - d / 2, cc[1] - w / 2, cc[0] + d / 2, cc[1] + w / 2]
    j.boards = true
    register(make(room, 'window_boards', r, n, { w, d, h: r2(j.y1 - j.y0 + 0.1), y: r2(j.y0 - 0.05), mount: 'window', window: j.id }) as Item, { window: j.id })
  }
  // barricades
  const blocked = new Set<string>()
  for (const p of exteriorDoors) {
    if (p.model === 'steel' || p.width > 2.0 || p.type === 'zip') continue
    const hasGarageDoor = plan.style === 'rural' && exteriorDoors.some((q) => roomById(q.a)?.type === 'garage')
    const usable = exteriorDoors.filter((q) => roomById(q.a)?.type !== 'garage')
    if (hasGarageDoor && p.side !== 'front' && usable.filter((q) => !blocked.has(q.id) && q !== p).length === 0) continue // with a garage door, one entrance stays unbarricaded
    if (!(p.side === 'front' || rng() < 0.6)) continue
    const room = roomById(p.a)
    if (!room) continue
    const n: Vec2 = p.axis === 'u' ? [0, p.v === room.parts[0][1] || room.parts.some((q) => Math.abs(q[1] - p.v) < 0.01) ? 1 : -1] : [room.parts.some((q) => Math.abs(q[0] - p.u) < 0.01) ? 1 : -1, 0]
    const allInRoom = itemsOfRoom(room) as Item[]
    const cands = allInRoom.filter((m) => !m.flat && !m.on && !m.decor && HEAVY_CATEGORIES.has(m.category) && !m.barricade && !allInRoom.some((q) => q.on === m.slot || q.supportId === m.id))
    const otherZones: Rect[] = plan.doors.filter((q) => q.floor === p.floor && q !== p && (q.a === room.id || q.b === room.id)).flatMap((q) => q.zones)
    const tryPlace = (type: string, ref: Item | null) => {
      const it = CATALOG[type]
      const f = n
      const [extentU, extentV] = extent([it.w, it.d], f)
      const dp = n[1] ? extentV : extentU
      const cx = p.u + n[0] * (MARGIN + 0.05 + dp / 2)
      const cz = p.v + n[1] * (MARGIN + 0.05 + dp / 2)
      const inners = usableParts(room, 0)
      const solids = (itemsOfRoom(room) as Item[])
        .filter((m) => m !== ref && !m.flat && !m.on && (!m.decor || m.mount === 'floor'))
        .map((m) => m._r as Rect)
        .concat(extraSolids[room.id] || [])
      for (const dl of SHIFTS) {
        const c2 = p.axis === 'u' ? [cx + dl, cz] : [cx, cz + dl]
        const r: Rect = [c2[0] - extentU / 2, c2[1] - extentV / 2, c2[0] + extentU / 2, c2[1] + extentV / 2]
        if (!insideUnion(r, inners) || solids.some((o) => overlaps(r, o)) || otherZones.some((z) => overlaps(r, z)) || !p.zones.some((z: Rect) => overlaps(r, z, 0.01))) continue // the barricade must cover the door zone
        ctx.setIgnored(new Set([...blocked, p.id]))
        const free = reachable(ctx.gridOf(room), solids.concat([r]), room.outdoor ? 0.12 : plan.playerRadius)
        ctx.setIgnored(blocked)
        if (!free) continue
        return { rect: r, f }
      }
      return null
    }
    let done: Item | null = null
    for (const m of shuffle(cands, rng)) {
      const tp = tryPlace(m.type, m)
      if (!tp) continue
      Object.assign(m, { moved: { from: [m.x, m.z], ry: m.ry }, barricade: true, x: r2((tp.rect[0] + tp.rect[2]) / 2), z: r2((tp.rect[1] + tp.rect[3]) / 2), frontU: tp.f[0], frontV: tp.f[1], ry: facingRotation(tp.f, m.type), aabb: tp.rect.map(r2), _r: tp.rect })
      done = m
      break
    }
    if (!done)
      for (const type of ['wardrobe', 'shelf_unit', 'sofa_2seat', 'wardrobe_small', 'shelf_unit_small', 'fridge']) {
        if (!CATALOG[type]) continue
        const tp = tryPlace(type, null)
        if (!tp) continue
        done = make(room, type, tp.rect, tp.f, { decor: false, mount: undefined, slot: 'barricade', id: room.id + '.barricade' + p.id, clearance: 0, flat: false, low: false, barricade: true, created: true }) as Item
        delete done.mount
        delete done.decor
        items.push(done)
        break
      }
    if (!done) continue
    p.blocked = true
    blocked.add(p.id)
    register(Object.assign({}, done, { type: 'barricade', category: 'barricade' }) as Item, { door: p.id, item: done.id, itemType: done.type })
  }
  ctx.setIgnored(blocked)
  // sandbags at the gates (one each side, lying or standing, nearer or farther)
  if (plan.lot)
    for (const g of plan.gates) {
      if (g.type === 'cargo') continue
      const side = g.side === 'front' ? 1 : -1
      const vA = g.side === 'front' ? g.v + MARGIN + 0.05 : g.v - MARGIN - 0.05
      for (const sd of shuffle([-1, 1], rng)) {
        let ok = false
        for (const depth of [0, 0.6, 1.2])
          for (const gap of [0.15, 0.5, 1.0])
            for (const upright of [false, true]) {
              if (ok) break
              const x0 = g.u + sd * (g.width / 2 + gap)
              const a = upright ? 0.5 : 1.2
              const b = upright ? 1.2 : 0.5
              const v0 = side > 0 ? vA + depth : vA - depth - b
              const r: Rect = sd < 0 ? [x0 - a, v0, x0, v0 + b] : [x0, v0, x0 + a, v0 + b]
              const z = roomAt(plan, (r[0] + r[2]) / 2, (r[1] + r[3]) / 2, -1)
              if (!z) continue
              const rr = placeOnFloor(z, 'sandbags', rng, { cands: [r] })
              if (!rr) continue
              addSolid(z, rr)
              register(make(z, 'sandbags', rr, upright ? [1, 0] : [0, side], { mount: 'floor' }) as Item, { gate: g.id })
              ok = true
            }
      }
    }
  // wall tops
  if (plan.lot) {
    const segs = plan.lot.perimeter.filter((s: Item) => s.type !== 'railing')
    const applyTop = (s: Item) => {
      const previous = s.top
      const next = rng() < 0.5 ? 'barbed_wire' : 'razor_wire'
      const finalTop = previous === 'razor_wire' ? 'razor_wire' : next // existing razor wire stays
      s.top = finalTop
      s.totalHeight = r2(s.height + c.wallTopHeights[finalTop])
      const cx = (s.u0 + s.u1) / 2
      const cz = (s.v0 + s.v1) / 2
      const len = Math.hypot(s.u1 - s.u0, s.v1 - s.v0)
      out.push({
        id: t.nextId(finalTop),
        state: c.state,
        type: finalTop,
        category: finalTop,
        perimeter: s.id,
        previousTop: previous,
        x: r2(cx),
        z: r2(cz),
        w: r2(len),
        d: 0.1,
        h: CATALOG[finalTop].h,
        y: s.height,
        ry: s.axis === 'u' || Math.abs(s.v1 - s.v0) < 0.01 ? 0 : r2(Math.PI / 2),
        mount: 'wall_top',
        outdoor: true,
        floor: -1,
        room: null,
        stateItem: true,
      } as unknown as Item)
    }
    for (const s of segs) if (rng() <= 0.85) applyTop(s)
    if (!out.some((e) => e.category === 'barbed_wire' || e.category === 'razor_wire') && segs.length) applyTop(segs[0])
  }
  // supplies
  const supplyRooms = groundFloorRooms.filter((r) => ['kitchen', 'laundry', 'stockroom', 'dining', 'shop', 'living'].includes(r.type)).concat(campZones)
  for (let i = 0, n = 2 + Math.floor(rng() * 3); i < n; i++) placeMany(supplyRooms, ['water_bottle_crates', 'canned_food', 'water_jug'][Math.floor(rng() * 3)], {}, 1)
  // safest room: fewest openings to the outside
  const cands = groundFloorRooms
    .filter((r) => ['bedroom', 'living', 'office', 'closet', 'cinema', 'shop', 'stockroom'].includes(r.type))
    .map((r) => ({ at: r, s: plan.doors.filter((p) => p.exterior && p.a === r.id).length * 2 + plan.windows.filter((j) => j.room === r.id).length + rng() * 0.5 }))
    .sort((a, b) => a.s - b.s)
  let seg: Room | null = null
  // first safe room where the mattress fits
  for (const cd of (cands as { at: Room; s?: number }[]).concat(groundFloorRooms.filter((r) => !cands.some((q) => q.at === r) && !['garage', 'bathroom', 'stairs', 'elevator', 'void'].includes(r.type)).map((r) => ({ at: r })))) {
    for (const dim of [[0.9, 1.9], [1.9, 0.9], [0.8, 1.6], [1.6, 0.8], [0.7, 1.4], [1.4, 0.7]]) {
      const r = placeOnFloor(cd.at, 'floor_mattress', rng, { dim })
      if (r) {
        addSolid(cd.at, r)
        register(make(cd.at, 'floor_mattress', r, dim[0] > dim[1] ? [1, 0] : [0, 1], { mount: 'floor', w: Math.min(...dim), d: Math.max(...dim) }) as Item)
        seg = cd.at
        break
      }
    }
    if (seg) break
  }
  if (!seg) {
    // tight houses: sweep the floor on a fixed grid for a free corner for the mattress
    const fallback = (cands as { at: Room; s?: number }[]).concat(groundFloorRooms.filter((r) => !cands.some((q) => q.at === r) && !['garage', 'bathroom', 'stairs', 'elevator', 'void'].includes(r.type)).map((r) => ({ at: r })))
    for (const cd of fallback) {
      for (const dim of [[0.9, 1.9], [1.9, 0.9], [0.8, 1.6], [1.6, 0.8], [0.7, 1.4], [1.4, 0.7]]) {
        const parts = usableParts(cd.at, 0)
        const spots: Rect[] = []
        for (const p of parts) for (let x = p[0]; x + dim[0] <= p[2] + 1e-6; x += 0.2) for (let z = p[1]; z + dim[1] <= p[3] + 1e-6; z += 0.2) spots.push([x, z, x + dim[0], z + dim[1]])
        const margin = (q: Rect) => Math.min(...parts.map((p) => Math.min(q[0] - p[0], q[1] - p[1], p[2] - q[2], p[3] - q[3])).filter((v) => v >= -1e-6), 9)
        spots.sort((m, n) => margin(m) - margin(n) || m[0] - n[0] || m[1] - n[1]) // against the walls, away from the walkway
        const r = placeOnFloor(cd.at, 'floor_mattress', rng, { dim, cands: spots, ordered: true })
        if (r) {
          addSolid(cd.at, r)
          register(make(cd.at, 'floor_mattress', r, dim[0] > dim[1] ? [1, 0] : [0, 1], { mount: 'floor', w: Math.min(...dim), d: Math.max(...dim) }) as Item)
          seg = cd.at
          break
        }
      }
      if (seg) break
    }
  }
  const lanternRoom = seg || groundFloorRooms[0]
  if (lanternRoom) {
    const table = (itemsOfRoom(lanternRoom) as Item[]).find((m) => SUPPORT_CATEGORIES.has(m.category) && !m.decor && !m.on && m.w >= 0.35)
    for (const type of ['lantern', 'candles']) {
      if (table && rng() < 0.8) {
        const it = CATALOG[type]
        const dx = (rng() - 0.5) * Math.max(0, table.w - 0.4)
        const cx = table.x + (table.frontV ? dx : 0)
        const cz = table.z + (table.frontV ? 0 : dx)
        register(make(lanternRoom, type, [cx - it.w / 2, cz - it.d / 2, cx + it.w / 2, cz + it.d / 2], [0, 1], { y: r2(topOf(table)), supportId: table.id, mount: 'support' }) as Item)
      } else if (!t.placeItem(lanternRoom, type, {})) placeMany(groundFloorRooms, type, {}, 1)
    }
  }
  return out
}

function abandoned(c: StateContext): PlacedItem[] {
  const t = toolbox(c)
  const { plan, items, rng, make, roomById, out, placeMany, groundFloorRooms, campZones } = t
  void make
  void roomById
  const openedDoors: string[] = []
  for (const p of plan.doors)
    if (rng() < (p.exterior ? 0.45 : 0.5)) {
      p.open = true
      openedDoors.push(p.id)
    }
  if (!openedDoors.length && plan.doors.length) {
    const p = plan.doors[Math.floor(rng() * plan.doors.length)]
    p.open = true
    openedDoors.push(p.id)
  }
  if (openedDoors.length) out.push({ id: t.nextId('open_doors'), state: c.state, type: 'open_doors', category: 'open_doors', doors: openedDoors, stateItem: true } as unknown as Item)
  const bedrooms = groundFloorRooms.concat(plan.rooms.filter((r) => r.floor > 0)).filter((r) => r.type === 'bedroom')
  if (placeMany(bedrooms, 'open_suitcases', {}, Math.min(2, bedrooms.length)) === 0) placeMany(groundFloorRooms.filter((r) => ['living', 'corridor', 'hall', 'dining', 'shop'].includes(r.type)), 'open_suitcases', {}, 1)
  const everything = plan.rooms.filter((r) => ['bedroom', 'living', 'corridor', 'kitchen', 'bathroom', 'dining', 'office', 'hall', 'shop', 'stockroom', 'counter'].includes(r.type)).concat(campZones)
  const clothesWanted = 3 + Math.floor(rng() * 3)
  let clothes = placeMany(everything, 'clothes_on_floor', { flat: true }, clothesWanted)
  for (let k = 0; k < 6 && clothes < 2; k++) clothes += placeMany(everything, 'clothes_on_floor', { flat: true }, 2 - clothes)
  const ransacked = (items as Item[]).filter((m) => CONTAINER_CATEGORIES.has(m.category) && !m.decor && !m.on && rng() < 0.65)
  for (const m of ransacked) m.ransacked = true
  if (ransacked.length) out.push({ id: t.nextId('ransacked_drawers'), state: c.state, type: 'ransacked_drawers', category: 'ransacked_drawers', items: ransacked.map((m) => m.id), stateItem: true } as unknown as Item)
  const tableRooms = plan.rooms.filter((r) => ['dining', 'kitchen', 'living', 'gourmet', 'shop', 'office'].includes(r.type)).concat(campZones)
  placeMany(tableRooms, 'fallen_chair', {}, 1 + Math.floor(rng() * 2))
  const cars = (items as Item[]).filter((m) => m.category === 'car' && !m.decor)
  const inGarage = cars.filter((m) => {
    const r = t.roomById(m.room as string)
    return r && r.type === 'garage'
  })
  const car = (inGarage.length ? inGarage : cars)[0]
  if (car) {
    car.doorOpen = true
    const n = t.bump()
    out.push(Object.assign({}, car, { id: 'state.' + n + '.car', _seedId: legacyCarId(n), state: c.state, type: 'car', category: 'car', item: car.id, doorOpen: true, stateItem: true, _r: car._r }) as Item)
  }
  const bloodRooms = plan.rooms.filter((r) => ['corridor', 'living', 'bedroom', 'kitchen', 'hall', 'dining', 'shop', 'stockroom'].includes(r.type)).concat(campZones)
  const stainsWanted = 2 + Math.floor(rng() * 3)
  let stains = placeMany(bloodRooms, 'blood_stains', { flat: true }, stainsWanted)
  for (let k = 0; k < 6 && stains < 2; k++) stains += placeMany(bloodRooms, 'blood_stains', { flat: true }, 2 - stains) // a tight room: insist until there are at least 2 stains
  if (plan.lot) {
    const openedGates: string[] = []
    for (const g of plan.gates)
      if (g.type !== 'cargo' && rng() < (g.type === 'garage' ? 0.8 : 0.6)) {
        g.open = true
        openedGates.push(g.id)
      }
    if (!openedGates.length) {
      const g = plan.gates.find((x) => x.type !== 'cargo')
      if (g) {
        g.open = true
        openedGates.push(g.id)
      }
    }
    if (openedGates.length) out.push({ id: t.nextId('open_gates'), state: c.state, type: 'open_gates', category: 'open_gates', gates: openedGates, stateItem: true } as unknown as Item)
  }
  return out
}

/** Fortified house: boarded windows, barricaded doors, sandbags, wire on the walls, supplies and a camp. */
export const fortifiedState: StatePlugin = { seedKey: LEGACY_STREAMS.fortified, apply: fortified }

/** Abandoned house: open doors, suitcases, scattered clothes, ransacked drawers, blood and a car with its door open. Colours are dirtier. */
export const abandonedState: StatePlugin = {
  seedKey: LEGACY_STREAMS.abandoned,
  adjustPalette(roles) {
    // dirt: desaturate and darken a little
    for (const k of Object.keys(roles)) {
      roles[k].s *= 0.75
      roles[k].l *= 0.9
    }
  },
  apply: abandoned,
}
