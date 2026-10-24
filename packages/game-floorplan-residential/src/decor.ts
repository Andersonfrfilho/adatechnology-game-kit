import type { DecorPass, DecorPassContext, PlacedItem, Rect, Room, Vec2 } from '@adatechnology/game-floorplan'
import type { DecorProfile } from './decor-profiles'

const NO_CEILING_TYPES = new Set(['void', 'elevator', 'balcony', 'terrace', 'porch', 'tent'])
const PICTURE_BASE: Record<string, number> = { living: 1, dining: 0.8, bedroom: 0.8, hall: 0.8, office: 0.5, corridor: 0.4, cinema: 0.5, bathroom: 0.4, kitchen: 0.3 }
const SUPPORT_CATEGORIES = new Set(['coffee_table', 'sideboard', 'console_table', 'tv_unit', 'dining_table', 'dining_table_large', 'dresser', 'nightstand', 'buffet', 'desk', 'office_desk', 'bench'])

interface WallRun {
  axis: 'u' | 'v'
  pos: number
  side: number
  a0: number
  a1: number
  exterior: boolean
  raw: [number, number]
}

/**
 * Residential decor: ceiling lights, split air conditioners with their condensers, pictures and
 * mirrors, plants and curtains. Runs after the slot fill and before the ground cover.
 */
export const decorPass: DecorPass = (c: DecorPassContext) => {
  const { plan, items, rng, ctx, kit, catalog: CATALOG, profiles, seed } = c
  const { MARGIN, r2, clamp, overlaps, inner, inflate, topOf, zonesOfFloor, roomAt, reachable, pickWeighted, cutIntervals, createRng, roomSeedKey } = kit
  const density: DecorProfile = profiles[plan.style] || profiles.mid
  const isBudget = density === profiles.budget
  const isHigh = density === profiles.high
  const isApartment = !plan.tpl.lot
  const { make, add, added, itemsOfRoom, placeOnFloor, gridOf, roomById } = ctx
  void roomById

  const wallRuns = (room: Room): WallRun[] => {
    const out: WallRun[] = []
    for (const p of plan.walls) {
      if (p.floor !== room.floor || p.type !== 'wall' || !p.sides.includes(room.id)) continue
      const side = p.sides[1] === room.id ? 1 : -1
      const axis: 'u' | 'v' = p.axis
      const a0 = axis === 'u' ? p.u0 : p.v0
      const a1 = axis === 'u' ? p.u1 : p.v1
      const pos = axis === 'u' ? p.v0 : p.u0
      let runs: [number, number][] = [[a0 + 0.25, a1 - 0.25]]
      for (const j of plan.windows)
        if (j.floor === room.floor && j.axis === axis && Math.abs((axis === 'u' ? j.v : j.u) - pos) < 0.01) {
          const center = axis === 'u' ? j.u : j.v
          runs = cutIntervals(runs, center - j.width / 2 - 0.2, center + j.width / 2 + 0.2)
        }
      for (const i of runs) if (i[1] - i[0] >= 0.5) out.push({ axis, pos, side, a0: i[0], a1: i[1], exterior: p.exterior, raw: [a0, a1] })
    }
    return out
  }
  const wallRect = (seg: WallRun, w: number, d: number, center: number): Rect => {
    const off = MARGIN + d / 2
    const n = seg.side
    return seg.axis === 'u' ? [center - w / 2, seg.pos + n * off - d / 2, center + w / 2, seg.pos + n * off + d / 2] : [seg.pos + n * off - d / 2, center - w / 2, seg.pos + n * off + d / 2, center + w / 2]
  }
  const segNormal = (seg: WallRun): Vec2 => (seg.axis === 'u' ? [0, seg.side] : [seg.side, 0])

  // ---- condensers (declared first: used by the per-room loop) ----
  const condenserOutside = (room: Room, seg: WallRun, c0: number, _split: PlacedItem): PlacedItem | null => {
    void _split
    const it = CATALOG.ac_condenser
    const n = segNormal(seg)
    const side = -seg.side
    const solidList = items.filter((m) => m.outdoor && !m.flat && !m.on).map((m) => m._r as Rect)
    const zones = zonesOfFloor(plan, -1)
    const pools = items.filter((m) => m.category === 'pool').map((m) => inflate(m._r as Rect, 1.2))
    for (const dc of [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5]) {
      const center = c0 + dc
      if (center - it.w / 2 < seg.raw[0] + 0.2 || center + it.w / 2 > seg.raw[1] - 0.2) continue
      const off = MARGIN + 0.06 + it.d / 2
      const r: Rect =
        seg.axis === 'u'
          ? [center - it.w / 2, seg.pos + side * off - it.d / 2, center + it.w / 2, seg.pos + side * off + it.d / 2]
          : [seg.pos + side * off - it.d / 2, center - it.w / 2, seg.pos + side * off + it.d / 2, center + it.w / 2]
      const f: Vec2 = [-n[0], -n[1]]
      if (room.floor > 0) {
        const cs: Vec2[] = [[r[0] + 0.01, r[1] + 0.01], [r[2] - 0.01, r[3] - 0.01], [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]]
        if (cs.some((p) => roomAt(plan, p[0], p[1], room.floor)) || added.some((q) => q.type === 'ac_condenser' && q.floor === room.floor && overlaps(r, q._r as Rect))) continue
        return add(make(room, 'ac_condenser', r, f, { room: room.id, y: 0.3, bracket: 'wall' }))
      }
      const cs: Vec2[] = [[r[0] + 0.01, r[1] + 0.01], [r[2] - 0.01, r[1] + 0.01], [r[0] + 0.01, r[3] - 0.01], [r[2] - 0.01, r[3] - 0.01]]
      const z0 = roomAt(plan, cs[0][0], cs[0][1], -1)
      if (!z0 || cs.some((p) => roomAt(plan, p[0], p[1], -1) !== z0)) continue
      if (solidList.some((o) => overlaps(r, o)) || zones.some((z) => overlaps(r, z)) || pools.some((p) => overlaps(r, p))) continue
      const zoneSolids = items.filter((m) => m.room === z0.id && !m.flat && !m.on).map((m) => m._r as Rect)
      if (!reachable(gridOf(z0), zoneSolids.concat([r]), 0.15)) continue
      return add(make(z0, 'ac_condenser', r, f, { room: z0.id, outdoor: true, floor: -1, side: room.id }))
    }
    return null
  }
  const condenserOnBalcony = (room: Room, _split: PlacedItem): PlacedItem | null => {
    void _split
    const v = plan.rooms.find((r) => r.type === 'balcony' && r.floor === room.floor)
    if (!v) return null
    const r = placeOnFloor(v, 'ac_condenser', rng, { without: (q: Rect) => added.some((n2) => n2.type === 'ac_condenser' && overlaps(q, n2._r as Rect)) })
    return r ? add(make(v, 'ac_condenser', r, [0, -1], { mount: 'floor' })) : null
  }

  // ---- per room ----
  for (const room of plan.rooms) {
    const ceiling = room.ceiling || plan.floors[room.floor].ceiling
    const P0 = room.parts[0]
    const area = (P0[2] - P0[0]) * (P0[3] - P0[1])
    const isOpen = NO_CEILING_TYPES.has(room.type)
    const windowsOut = plan.windows.filter((j) => j.floor === room.floor && j.room === room.id)
    const segs = isOpen ? [] : wallRuns(room)
    const placed: Rect[] = []
    const wallFree = (r: Rect, y0: number, y1: number) =>
      !itemsOfRoom(room).some((m) => !m.decor && overlaps(inflate(r, 0.02), m.aabb) && topOf(m) > y0 - 0.02 && (m.y || 0) < y1) && !placed.some((q) => overlaps(inflate(r, 0.05), q))
    const pickWall = (w: number, d: number, y0: number, y1: number, pred?: (s: WallRun) => boolean, attempts?: number) => {
      for (let k = 0; k < (attempts || 8); k++) {
        const cs = segs.filter((s) => (!pred || pred(s)) && s.a1 - s.a0 >= w + 0.1)
        if (!cs.length) return null
        let total = 0
        for (const s of cs) total += s.a1 - s.a0
        let x = rng() * total
        let s = cs[0]
        for (const q of cs) {
          x -= q.a1 - q.a0
          if (x < 0) {
            s = q
            break
          }
        }
        const center = s.a0 + w / 2 + 0.05 + rng() * (s.a1 - s.a0 - w - 0.1)
        const r = wallRect(s, w, d, center)
        if (wallFree(r, y0, y1)) return { s, at: center, rect: r }
      }
      return null
    }
    // ceiling lights
    if (!isOpen) {
      let n = isBudget ? (area > 16 ? 2 : 1) : clamp(Math.ceil(area / density.lightAreaPerLight), 1, 6)
      if (['bathroom', 'corridor', 'laundry', 'garage'].includes(room.type)) n = Math.min(n, room.type === 'garage' ? 3 : 1)
      const table = itemsOfRoom(room).find((m) => m.category === 'dining_table' || m.category === 'dining_table_large' || m.category === 'gourmet')
      const cols = Math.ceil(Math.sqrt((n * (P0[2] - P0[0])) / Math.max(1, P0[3] - P0[1])))
      const rows = Math.ceil(n / cols)
      for (let i = 0; i < n; i++) {
        let type = pickWeighted(rng, density.light)
        let cx = P0[0] + (((i % cols) + 0.5) / cols) * (P0[2] - P0[0])
        let cz = P0[1] + ((Math.floor(i / cols) + 0.5) / rows) * (P0[3] - P0[1])
        if (i === 0 && table && !isBudget && rng() < 0.85) {
          cx = table.x
          cz = table.z
          type = 'pendant'
        }
        if (type === 'chandelier' && !['living', 'dining', 'hall'].includes(room.type)) type = 'ceiling_light'
        if (i === 0 && ceiling > 4 && isHigh) type = 'chandelier'
        const it = CATALOG[type]
        const y = r2(ceiling - it.h - (ceiling > 4 && (type === 'chandelier' || type === 'pendant') ? 1.2 : 0))
        add(make(room, type, [cx - it.w / 2, cz - it.d / 2, cx + it.w / 2, cz + it.d / 2], [0, 1], { y, h: it.h }))
      }
    }
    // air conditioning (split + condenser)
    const acChance = (density.airConditioner || {})[room.type]
    if (!isOpen && acChance && rng() < acChance) {
      const it = CATALOG.wall_ac
      const pr = pickWall(it.w, it.d, 2.0, 2.28, (s) => isApartment || s.exterior, 40)
      if (pr) {
        const split = make(room, 'wall_ac', pr.rect, segNormal(pr.s), { y: 2.0, h: 0.28 })
        const condenser = isApartment ? condenserOnBalcony(room, split) : condenserOutside(room, pr.s, pr.at, split)
        if (condenser) {
          add(split)
          placed.push(pr.rect)
          split.par = condenser.id
          condenser.par = split.id
        }
      }
    }
    if (isOpen) {
      // Balconies already get pots from their slots. The original rolled (and discarded) a plant
      // chance here; the roll is kept so the seeded stream stays aligned.
      if (room.type !== 'void' && room.type !== 'elevator' && density.plantChance > 0) rng()
    } else {
      // pictures and mirrors
      const pictureCount = Math.floor((PICTURE_BASE[room.type] || 0) * density.mult + rng())
      for (let i = 0; i < pictureCount; i++) {
        let type = room.type === 'bathroom' ? 'mirror' : rng() < density.smallPictureChance ? 'picture_small' : 'picture_large'
        if (room.type !== 'bathroom' && ['hall', 'bedroom', 'corridor'].includes(room.type) && rng() < 0.2) type = 'mirror'
        const it = CATALOG[type]
        const centerY = 1.4 + rng() * 0.3
        const pr = pickWall(it.w, it.d, centerY - it.h / 2, centerY + it.h / 2)
        if (pr) {
          add(make(room, type, pr.rect, segNormal(pr.s), { y: r2(centerY - it.h / 2) }))
          placed.push(pr.rect)
        }
      }
      // plants
      if (!['garage', 'stairs', 'laundry'].includes(room.type)) {
        const floorPlants = (rng() < density.plantChance ? 1 : 0) + (isHigh && ['living', 'dining', 'hall'].includes(room.type) && rng() < 0.6 ? 1 : 0)
        for (let i = 0; i < floorPlants; i++) {
          const r = placeOnFloor(room, 'floor_plant', rng)
          if (r) add(make(room, 'floor_plant', r, [0, 1]))
        }
        // a table lamp on a nightstand or a low dresser, with its real footprint (0.36 m shade) kept off the walls
        const lit = new Set<string>()
        if (['bedroom', 'living'].includes(room.type)) {
          const lampRng = createRng(seed, 'abajur:' + roomSeedKey(room))
          const lampChance = isBudget ? 0.35 : density === profiles.mid ? 0.75 : 1
          for (const m of itemsOfRoom(room).filter((m) => ['nightstand', 'dresser', 'console_table'].includes(m.category) && !m.decor && !m.flat && m.h <= 0.8 && !m.on)) {
            if (lampRng() >= lampChance) continue
            const A = m.aabb
            const it = CATALOG.table_lamp
            const R = inner(room.parts.find((q) => A[0] >= q[0] - 1e-3 && A[2] <= q[2] + 1e-3 && A[1] >= q[1] - 1e-3 && A[3] <= q[3] + 1e-3) || room.parts[0])
            if (A[2] - A[0] < it.w - 1e-6 || A[3] - A[1] < it.d - 1e-6) continue
            const slackU = (A[2] - A[0] - it.w) / 2
            const slackV = (A[3] - A[1] - it.d) / 2
            const cx = m.x + (A[0] - R[0] < R[2] - A[2] ? slackU : -slackU)
            const cz = m.z + (A[1] - R[1] < R[3] - A[3] ? slackV : -slackV)
            add(make(room, 'table_lamp', [cx - it.w / 2, cz - it.d / 2, cx + it.w / 2, cz + it.d / 2], [m.frontU, m.frontV], { y: r2(topOf(m)), supportId: m.id }))
            lit.add(m.id)
            break
          }
        }
        let count = 0
        for (const m of itemsOfRoom(room).filter((m) => SUPPORT_CATEGORIES.has(m.category) && !m.decor && !m.flat && !lit.has(m.id) && !itemsOfRoom(room).some((o) => o.supportId === m.id && o.category === 'oil_lamp'))) {
          if (count >= 2 || rng() >= density.tablePlantChance || m.w < 0.35 || m.d < 0.3) continue
          if (itemsOfRoom(room).some((o) => o.on && o.aabb[0] === m.aabb[0] && o.aabb[1] === m.aabb[1] && o.aabb[2] === m.aabb[2])) continue
          const dx = (rng() - 0.5) * Math.max(0, m.aabb[2] - m.aabb[0] - 0.3)
          const dz = (rng() - 0.5) * Math.max(0, m.aabb[3] - m.aabb[1] - 0.3)
          const cx = m.x + dx
          const cz = m.z + dz
          add(make(room, 'table_plant', [cx - 0.1, cz - 0.1, cx + 0.1, cz + 0.1], [0, 1], { y: r2(topOf(m)), supportId: m.id }))
          count++
        }
        if (rng() < density.hangingPlantChance && windowsOut.length) {
          const R = inner(P0)
          const k = Math.floor(rng() * 4)
          const x = k % 2 ? R[2] - 0.45 : R[0] + 0.45
          const z = k < 2 ? R[1] + 0.45 : R[3] - 0.45
          const r: Rect = [x - 0.15, z - 0.15, x + 0.15, z + 0.15]
          if (!zonesOfFloor(plan, room.floor).some((zz) => overlaps(r, zz))) add(make(room, 'hanging_plant', r, [0, 1], { y: r2(ceiling - 1.2), h: 0.7 }))
        }
      }
      // curtains and blinds
      for (const j of windowsOut) {
        if (rng() >= density.curtain) continue
        const wet = ['kitchen', 'bathroom', 'laundry', 'garage'].includes(room.type)
        const type = wet || density === profiles.commercial || rng() < 0.25 ? 'blinds' : 'curtain'
        const n = ({ front: [0, 1], back: [0, -1], left: [1, 0], right: [-1, 0] } as Record<string, Vec2>)[j.side]
        const it = CATALOG[type]
        const w = r2(j.width + 0.3)
        const d = it.d
        const cc = j.axis === 'u' ? [j.u, j.v + n[1] * (MARGIN + d / 2)] : [j.u + n[0] * (MARGIN + d / 2), j.v]
        const r: Rect = j.axis === 'u' ? [cc[0] - w / 2, cc[1] - d / 2, cc[0] + w / 2, cc[1] + d / 2] : [cc[0] - d / 2, cc[1] - w / 2, cc[0] + d / 2, cc[1] + w / 2]
        const h = type === 'curtain' ? r2(Math.min(ceiling - 0.1, j.y1 + 0.25)) : r2(j.y1 - j.y0 + 0.2)
        add(make(room, type, r, n, { w, h, y: type === 'curtain' ? 0.05 : r2(j.y0 - 0.1), window: j.id }))
      }
    }
  }
  // mailbox on the front wall, beside the pedestrian gate
  if (plan.lot && plan.style !== 'commercial') {
    const gate = plan.gates.find((x) => x.type === 'pedestrian')
    const it = CATALOG.mailbox
    const setback = plan.lot.setback
    if (gate)
      for (const dir of [1, -1]) {
        const u = gate.u + dir * (gate.width / 2 + 0.35)
        const segment = plan.lot.perimeter.find((q: { side: string; u0: number; u1: number }) => q.side === 'front' && Math.min(q.u0, q.u1) <= u - it.w / 2 + 1e-6 && Math.max(q.u0, q.u1) >= u + it.w / 2 - 1e-6)
        const zone = plan.zones.find((z) => z.parts.some((q) => u >= q[0] && u <= q[2] && -setback + 0.1 >= q[1] && -setback + 0.1 <= q[3]))
        if (!segment || !zone) continue
        const box = make(zone, 'mailbox', [u - it.w / 2, -setback - it.d / 2, u + it.w / 2, -setback + it.d / 2], [0, -1])
        add(Object.assign(box, { y: 1.1, slot: 'mailbox', perimeter: segment.id, side: 'front', gate: gate.id }))
        break
      }
  }
}
