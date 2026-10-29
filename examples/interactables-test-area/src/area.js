// Furniture and interactive objects area for the shared destruction test room.
//
// `createFurnitureArea` returns a module that follows the `TestableModule` contract of @adatechnology/game-contracts (types only:
// `@adatechnology/game-contracts`; nothing here imports it at run time): one item per household type, drawn through the three adapter, with
//   - a `DestructibleSpec` derived from the drawing (every static primitive is clustered into a destruction piece; every movable part of the
//     household spec is a piece of its own, tagged by `PartSpec.destruction`),
//   - `animations` for every door, drawer, lid, flap, knob and rocker (derived from the part's `Motion`),
//   - `fluid` for the fixtures that hold water,
//   - scenarios (pt-BR and en) written against the test room's `ScenarioContext`.
import { buildScenarios } from './scenarios.js'

const MAX_PIECES = { bbq: 30, clothesline: 24, dog_house: 24, gas_bottle: 6, microwave: 10, washing_machine: 12, tv: 8, fridge_compact: 12, utility_sink: 12, wall_socket: 3, wall_switch: 3 }
const DEFAULT_MAX_PIECES = 18
const WOOD_FAMILY = new Set(['wood_soft', 'wood_hard', 'mdf', 'plywood'])
const METAL_FAMILY = new Set(['steel', 'aluminium', 'cast_iron', 'copper'])
const UPHOLSTERED = new Set(['sofa', 'armchair', 'bed_double', 'bed_single'])
// render material key -> destruction material, where the type's body material is not the right answer for that key
const KEY_OVERRIDES = {
  shower: { plain: 'ceramic', metal: 'aluminium', glass: 'tempered_glass' },
  sink_kitchen: { wood: 'mdf' },
  sink_bathroom: { wood: 'mdf' },
  mailbox: { wood: 'steel' },
}
// fixtures that hold water: inner volume (m), litres at the start, where the opening is
const FLUIDS = {
  sink_kitchen: { liters: 4, capacity: 14, size: [0.5, 0.16, 0.36], opening: 0.2 },
  sink_bathroom: { liters: 2, capacity: 6, size: [0.34, 0.12, 0.28], opening: 0.15 },
  utility_sink: { liters: 8, capacity: 28, size: [0.5, 0.25, 0.4], opening: 0.22 },
  toilet: { liters: 3, capacity: 6, size: [0.3, 0.18, 0.3], opening: 0.14 },
}
// total mass of a whole object in kg (the household drawing is solid blocks, so the volume would give a fridge of two tonnes)
const MASS = {
  fridge: 70, fridge_compact: 30, kitchen_cabinet_base: 35, kitchen_cabinet_wall: 15, pantry: 50, wardrobe: 90, dresser: 45, nightstand: 12,
  bathroom_cabinet: 10, stove: 45, gas_bottle: 16, sink_kitchen: 40, sink_bathroom: 25, shower: 90, toilet: 30, utility_sink: 25,
  wall_socket: 0.05, wall_switch: 0.05, service_entrance: 60, electrical_panel: 8, power_meter: 3, conduit_run: 2, tv: 12, microwave: 14,
  washing_machine: 70, sofa: 45, armchair: 25, dining_chair: 5, bed_double: 60, bed_single: 30, bench: 15, blinds: 3, curtain: 3, trash_bin: 3,
  wheelie_bin: 12, mailbox: 6, dog_house: 20, bbq: 400, clothesline: 15,
}
const DENSITY = {
  steel: 7850, aluminium: 2700, cast_iron: 7200, copper: 8900, wood_soft: 550, wood_hard: 750, mdf: 700, plywood: 600, glass: 2500,
  tempered_glass: 2500, ceramic: 2300, plastic: 1000, rubber: 1100, fabric: 250, foam: 40, brick: 1800, concrete: 2400, foliage: 100,
}
// wall thickness of hollow things (appliance shells, sheet metal, ceramic bowls)
const THICKNESS = { steel: 0.0012, aluminium: 0.001, copper: 0.002, plastic: 0.003, ceramic: 0.012, glass: 0.004, tempered_glass: 0.006 }
const SOUND = { door: 'door', drawer: 'drawer', lid: 'lid', flap: 'flap', knob: 'knob', button: 'click', rocker: 'click', breaker: 'click' }

const sanitize = (id) =>
  String(id)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d

// ---------------------------------------------------------------------------------------------------------------------------------------
// Geometry of the recorded primitives (axis-aligned boxes in the frame they were drawn in)
// ---------------------------------------------------------------------------------------------------------------------------------------
const rotX = (v, a) => [v[0], v[1] * Math.cos(a) - v[2] * Math.sin(a), v[1] * Math.sin(a) + v[2] * Math.cos(a)]
const rotY = (v, a) => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)]
const rotZ = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a), v[2]]

function aabbOfBox(c, size, ry = 0, rx = 0, rz = 0) {
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  for (const sx of [-0.5, 0.5])
    for (const sy of [-0.5, 0.5])
      for (const sz of [-0.5, 0.5]) {
        let v = [sx * size[0], sy * size[1], sz * size[2]]
        if (rz) v = rotZ(v, rz)
        if (rx) v = rotX(v, rx)
        if (ry) v = rotY(v, ry)
        for (let k = 0; k < 3; k++) {
          lo[k] = Math.min(lo[k], c[k] + v[k])
          hi[k] = Math.max(hi[k], c[k] + v[k])
        }
      }
  return [...lo, ...hi]
}

/** Box, volume and render material key of one primitive call. */
function describePrimitive(fn, a) {
  // a = [M, material, ...] (box, cylinder, plane) or [M, x, ...] (leaf)
  if (fn === 'box') {
    const [, material, x, y, z, w, h, d, , ry = 0, rx = 0, rz = 0] = a
    return { key: material, aabb: aabbOfBox([x, y + h / 2, z], [w, h, d], ry, rx, rz), vol: w * h * d }
  }
  if (fn === 'cylinder') {
    const [, material, x, y, z, r, h, , rx = 0, rz = 0, shape] = a
    const tilted = rx || rz
    const k = shape === 'cone' ? 1 / 3 : shape === 'sphere' ? 2 / 3 : 1
    return { key: material, aabb: aabbOfBox([x, tilted ? y : y + h / 2, z], [2 * r, h, 2 * r], 0, rx, rz), vol: Math.PI * r * r * h * k }
  }
  if (fn === 'plane') {
    const [, material, x, y, z, w, h, , ry = 0, rx = 0, rz = 0] = a
    return { key: material, aabb: aabbOfBox([x, y, z], [w, h, 0.012], ry, rx, rz), vol: w * h * 0.012 }
  }
  // leaf
  const [, x, y, z, w, h, , ry = 0] = a
  return { key: 'plant', aabb: aabbOfBox([x, y + h / 2, z], [w, h, w * 0.2], ry), vol: w * h * w * 0.1 }
}

const unionBox = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2]), Math.max(a[3], b[3]), Math.max(a[4], b[4]), Math.max(a[5], b[5])]
const boxVolume = (b) => Math.max(1e-9, (b[3] - b[0]) * (b[4] - b[1]) * (b[5] - b[2]))
const boxGap = (a, b) => {
  const dx = Math.max(0, a[0] - b[3], b[0] - a[3])
  const dy = Math.max(0, a[1] - b[4], b[1] - a[4])
  const dz = Math.max(0, a[2] - b[5], b[2] - a[5])
  return Math.hypot(dx, dy, dz)
}
const centre = (b) => [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2]

/** The part's closed-pose box in object space: the drawn boxes are relative to the pivot and turned by `ry`. */
function partBox(rec) {
  let box = null
  for (const p of rec.prims) {
    const lo = [p.aabb[0], p.aabb[1], p.aabb[2]]
    const hi = [p.aabb[3], p.aabb[4], p.aabb[5]]
    for (const sx of [lo[0], hi[0]])
      for (const sy of [lo[1], hi[1]])
        for (const sz of [lo[2], hi[2]]) {
          const v = rec.ry ? rotY([sx, sy, sz], rec.ry) : [sx, sy, sz]
          const w = [v[0] + rec.pivot[0], v[1] + rec.pivot[1], v[2] + rec.pivot[2]]
          box = box ? unionBox(box, [...w, ...w]) : [...w, ...w]
        }
  }
  return box
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Recording api: sits between the household pack and the mesh api (or nothing)
// ---------------------------------------------------------------------------------------------------------------------------------------
const FNS = ['box', 'cylinder', 'plane', 'leaf']

/**
 * Wraps the api a household pack draws through. Primitives drawn inside `part` go straight to `inner` (and are recorded per part);
 * static primitives are only recorded, and `flush` replays them into the destruction pieces of `plan` (one `part` group per piece), so the
 * drawing and the destruction share the same pieces.
 */
function createRecorder(inner) {
  const statics = []
  const parts = new Map()
  const stack = []
  const api = {
    light: (...a) => inner.light?.(...a),
    part(id, pivot, ry, draw) {
      stack.push(id)
      parts.set(id, { id, pivot: [...pivot], ry: ry || 0, prims: [] })
      inner.part(id, pivot, ry, draw)
      stack.pop()
    },
  }
  for (const fn of FNS) {
    api[fn] = (...args) => {
      const prim = { fn, args, ...describePrimitive(fn, args) }
      if (stack.length) {
        parts.get(stack[stack.length - 1]).prims.push(prim)
        inner[fn](...args)
      } else statics.push(prim)
    }
  }
  const flush = (pieces) => {
    for (const piece of pieces) {
      inner.part(piece.id, [0, 0, 0], 0, () => {
        for (const i of piece.indices) inner[statics[i].fn](...statics[i].args)
      })
    }
  }
  return { api, statics, parts, flush }
}

const NOOP = { part: (_id, _pivot, _ry, draw) => draw(), box() {}, cylinder() {}, plane() {}, leaf() {}, light() {} }

// ---------------------------------------------------------------------------------------------------------------------------------------
// Analysis: object spec -> destruction pieces, joints, animations
// ---------------------------------------------------------------------------------------------------------------------------------------
function materialFor(type, spec, key, box) {
  const body = spec.destruction?.material ?? 'plastic'
  const over = KEY_OVERRIDES[type]?.[key]
  if (over) return over
  if (key === 'glass' || key === 'emissive') return body === 'tempered_glass' ? 'tempered_glass' : 'glass'
  if (key === 'metal') return METAL_FAMILY.has(body) ? body : 'steel'
  if (key === 'wood') return WOOD_FAMILY.has(body) ? body : 'wood_soft'
  if (key === 'fabric') {
    const thick = Math.min(box[3] - box[0], box[4] - box[1], box[5] - box[2])
    return UPHOLSTERED.has(type) && thick >= 0.12 ? 'foam' : 'fabric'
  }
  if (key === 'plant') return 'foliage'
  return body
}

/** Clusters the static primitives into at most `max` pieces: tiny ones join the nearest piece, then the smallest join their neighbours. */
function clusterStatics(type, spec, statics) {
  const max = MAX_PIECES[type] ?? DEFAULT_MAX_PIECES
  let pieces = statics.map((p, i) => ({ indices: [i], box: p.aabb.slice(), vol: p.vol, keys: new Set([p.key]), area: { [p.key]: p.vol } }))
  const glassy = (p) => p.keys.has('glass') || p.keys.has('emissive')
  const size = (p) => Math.max(p.box[3] - p.box[0], p.box[4] - p.box[1], p.box[5] - p.box[2])
  const merge = (a, b) => {
    a.indices.push(...b.indices)
    a.box = unionBox(a.box, b.box)
    a.vol += b.vol
    for (const k of b.keys) a.keys.add(k)
    for (const [k, v] of Object.entries(b.area)) a.area[k] = (a.area[k] ?? 0) + v
  }
  const absorb = (small) => {
    let best = null
    let bestScore = Infinity
    for (const q of pieces) {
      if (q === small || glassy(q) !== glassy(small)) continue
      const gap = boxGap(small.box, q.box)
      const score = gap * 1000 - Math.log(boxVolume(q.box))
      if (score < bestScore) {
        bestScore = score
        best = q
      }
    }
    if (!best) return false
    merge(best, small)
    pieces = pieces.filter((p) => p !== small)
    return true
  }
  // 1. specks (screws, hinges, handles): smaller than 2 cm in every direction
  for (const p of pieces.slice()) if (size(p) < 0.02 && pieces.length > 1 && !glassy(p)) absorb(p)
  // 2. cap the count
  while (pieces.length > max) {
    const cand = pieces.filter((p) => !glassy(p) || pieces.filter(glassy).length > 3)
    const small = (cand.length ? cand : pieces).reduce((m, p) => (boxVolume(p.box) < boxVolume(m.box) ? p : m))
    if (!absorb(small)) break
  }
  return pieces.sort((a, b) => boxVolume(b.box) - boxVolume(a.box))
}

function partMotionPose(motion, ry, GT) {
  const pose = GT.poseOf(motion, 1)
  const [x, y, z, w] = pose.quaternion
  // quaternion -> Euler XYZ (the order of three's default Euler)
  const m13 = 2 * (x * z + w * y)
  const ey = Math.asin(Math.max(-1, Math.min(1, m13)))
  const ex = Math.abs(m13) < 0.9999999 ? Math.atan2(-2 * (y * z - w * x), 1 - 2 * (x * x + y * y)) : Math.atan2(2 * (y * z + w * x), 1 - 2 * (x * x + z * z))
  const ez = Math.abs(m13) < 0.9999999 ? Math.atan2(-2 * (x * y - w * z), 1 - 2 * (y * y + z * z)) : 0
  const p = pose.position
  const px = p[0] * Math.cos(ry) + p[2] * Math.sin(ry)
  const pz = -p[0] * Math.sin(ry) + p[2] * Math.cos(ry)
  return { position: [round(px), round(p[1]), round(pz)], rotation: [round(ex), round(ey), round(ez)] }
}

function buildAnimations(spec, ids, GT, present) {
  const movers = (spec.parts ?? []).filter((p) => p.motion.kind !== 'scale' && present.has(p.id))
  if (movers.length === 0) return []
  const info = movers.map((p) => {
    const kind = p.motion.kind
    const on = kind === 'knob' || kind === 'rocker'
    const piece = p.destruction?.piece ?? (kind === 'slide' ? 'drawer' : 'door')
    return {
      source: p.id,
      id: ids.get(p.id),
      on,
      pose: partMotionPose(p.motion, p.ry ?? 0, GT),
      seconds: on ? 0.4 : kind === 'slide' ? 0.8 : 1.1,
      sound: SOUND[piece] ?? 'door',
      requires: p.requires,
    }
  })
  // a part behind another part (an inner drawer behind a door) starts when that one is half way
  const staged = (list) => {
    const bySource = new Map(list.map((p) => [p.source, p]))
    const start = (p) => (p.requires && bySource.has(p.requires) ? start(bySource.get(p.requires)) + 0.5 : 0)
    return list.map((p) => ({ ...p, start: start(p), end: start(p) + p.seconds }))
  }
  const clip = (id, list, closing, sound) => {
    const parts = staged(list)
    const duration = Math.max(...parts.map((p) => p.end))
    const times = [...new Set([0, duration, ...parts.flatMap((p) => [p.start, p.end])])].sort((a, b) => a - b)
    const keys = times.map((t) => ({
      t: round(t, 3),
      parts: Object.fromEntries(
        parts.map((p) => {
          const f0 = Math.max(0, Math.min(1, (t - p.start) / (p.end - p.start)))
          const f = closing ? 1 - f0 : f0
          return [p.id, { position: p.pose.position.map((v) => round(v * f)), rotation: p.pose.rotation.map((v) => round(v * f)) }]
        }),
      ),
    }))
    return { id, duration: round(duration, 3), keys, events: [{ t: 0, type: 'sound', data: { key: `${sound}_${closing ? 'close' : 'open'}` } }] }
  }
  const clips = []
  const doors = info.filter((p) => !p.on)
  const knobs = info.filter((p) => p.on)
  if (doors.length) clips.push(clip('open_all', doors, false, 'door'), clip('close_all', doors, true, 'door'))
  if (knobs.length) clips.push(clip('on_all', knobs, false, 'switch'), clip('off_all', knobs, true, 'switch'))
  if (info.length <= 8) {
    for (const p of info) {
      clips.push(clip(`${p.on ? 'on' : 'open'}_${p.id}`, [p], false, p.sound), clip(`${p.on ? 'off' : 'close'}_${p.id}`, [p], true, p.sound))
    }
  }
  return clips
}

function analyse(hh, type, GT) {
  const rec = createRecorder(NOOP)
  const spec = hh.build(type, { seed: 1 }, rec.api)
  const clusters = clusterStatics(type, spec, rec.statics)

  const used = new Set()
  const unique = (base) => {
    let id = base
    for (let n = 2; used.has(id); n++) id = `${base}_${n}`
    used.add(id)
    return id
  }
  // movable parts first so their household ids keep their names
  const partIds = new Map()
  for (const p of spec.parts ?? []) partIds.set(p.id, unique(sanitize(p.id)))

  const pieces = []
  for (const c of clusters) {
    const dominant = Object.entries(c.area).sort((a, b) => b[1] - a[1])[0][0]
    const material = materialFor(type, spec, dominant, c.box)
    const base = dominant === 'emissive' ? 'screen' : material
    pieces.push({ id: unique(base), indices: c.indices, box: c.box, vol: c.vol, material, key: dominant, mover: false })
  }
  // objects drawn only as wires (conduit runs) have no primitives: each wire is one piece, a box around its points
  if (!pieces.length) {
    for (const w of spec.wires ?? []) {
      if (!w.points || w.points.length < 2) continue
      const r = w.radius ?? 0.01
      const lo = [Infinity, Infinity, Infinity]
      const hi = [-Infinity, -Infinity, -Infinity]
      let len = 0
      w.points.forEach((q, i) => {
        for (let k = 0; k < 3; k++) {
          lo[k] = Math.min(lo[k], q[k] - r)
          hi[k] = Math.max(hi[k], q[k] + r)
        }
        if (i) len += Math.hypot(q[0] - w.points[i - 1][0], q[1] - w.points[i - 1][1], q[2] - w.points[i - 1][2])
      })
      const material = spec.destruction?.material ?? 'plastic'
      pieces.push({ id: unique(w.kind === 'conduit' ? 'conduit' : w.kind), indices: [], box: [...lo, ...hi], vol: Math.PI * r * r * len, material, key: 'plain', mover: false })
    }
  }
  const movers = []
  for (const p of spec.parts ?? []) {
    const r = rec.parts.get(p.id)
    if (!r || r.prims.length === 0) continue
    const box = p.bounds ?? partBox(r)
    if (!box) continue
    const vol = r.prims.reduce((s, q) => s + q.vol, 0)
    const d = p.destruction ?? {}
    movers.push({ id: partIds.get(p.id), source: p, indices: [], box, vol, material: d.material ?? spec.destruction?.material ?? 'plastic', mover: true, tag: d })
  }

  const toPart = (pc, extra = {}) => {
    const size = [Math.max(0.004, pc.box[3] - pc.box[0]), Math.max(0.004, pc.box[4] - pc.box[1]), Math.max(0.004, pc.box[5] - pc.box[2])]
    const c = centre(pc.box)
    const fill = Math.max(0.03, Math.min(1, pc.vol / (size[0] * size[1] * size[2])))
    const part = {
      id: pc.id,
      material: pc.material,
      shape: { kind: 'box', size: size.map((v) => round(v)) },
      position: c.map((v) => round(v)),
      fill: round(pc.material === 'foam' || pc.material === 'fabric' ? fill * 0.5 : fill, 3),
      tags: [type, ...(pc.tag?.piece ? [pc.tag.piece] : [])],
    }
    return Object.assign(part, extra)
  }
  const all = [...pieces, ...movers]
  const body = spec.destruction ?? {}
  const weight = (pc) => {
    const [dx, dy, dz] = [pc.box[3] - pc.box[0], pc.box[4] - pc.box[1], pc.box[5] - pc.box[2]]
    const thin = THICKNESS[pc.material]
    return (thin ? Math.min(pc.vol, 2 * (dx * dy + dy * dz + dz * dx) * thin) : pc.vol) * (DENSITY[pc.material] ?? 800)
  }
  const totalWeight = all.reduce((sum, pc) => sum + weight(pc), 0) || 1
  const targetMass = MASS[type]
  const parts = all.map((pc) => {
    const extra = {}
    const own = pc.mover ? pc.tag : null
    if (own?.explodes) extra.explodes = { ...own.explodes }
    if (own?.contains) extra.contains = { ...own.contains }
    if (targetMass) extra.mass = round(Math.max(0.01, (targetMass * weight(pc)) / totalWeight), 3)
    if (pc.material === 'glass') extra.hp = 20
    if (pc.material === 'tempered_glass') extra.hp = 40
    const thin = THICKNESS[pc.material]
    if (thin) extra.thickness = Math.min(thin, Math.max(0.0005, Math.min(pc.box[3] - pc.box[0], pc.box[4] - pc.box[1], pc.box[5] - pc.box[2])))
    return toPart(pc, extra)
  })
  // the body's `explodes` / `contains` belong to the biggest body piece (the shell of the bottle)
  if (pieces.length && (body.explodes || body.contains)) {
    const shell = parts.find((p) => p.id === pieces[0].id)
    if (body.explodes) shell.explodes = { ...body.explodes }
    if (body.contains) shell.contains = { ...body.contains }
  }

  // joints: touching body pieces are fixed with the body's joint; each movable part hangs on the nearest body piece with its own joint
  const joints = []
  const degree = new Map()
  const bodyKind = body.joint ?? 'screw'
  const edges = []
  for (let i = 0; i < pieces.length; i++)
    for (let j = i + 1; j < pieces.length; j++) {
      const gap = boxGap(pieces[i].box, pieces[j].box)
      if (gap <= 0.01) edges.push({ a: pieces[i], b: pieces[j], gap })
    }
  edges.sort((x, y) => x.gap - y.gap || Math.min(boxVolume(y.a.box), boxVolume(y.b.box)) - Math.min(boxVolume(x.a.box), boxVolume(x.b.box)))
  const uf = new Map(pieces.map((p) => [p.id, p.id]))
  const find = (x) => (uf.get(x) === x ? x : (uf.set(x, find(uf.get(x))), uf.get(x)))
  const kindOf = (a, b) => (a.material.includes('glass') || b.material.includes('glass') ? 'clip' : bodyKind)
  for (const e of edges) {
    if ((degree.get(e.a.id) ?? 0) >= 5 || (degree.get(e.b.id) ?? 0) >= 5) continue
    degree.set(e.a.id, (degree.get(e.a.id) ?? 0) + 1)
    degree.set(e.b.id, (degree.get(e.b.id) ?? 0) + 1)
    uf.set(find(e.a.id), find(e.b.id))
    joints.push({ a: e.a.id, b: e.b.id, kind: kindOf(e.a, e.b) })
  }
  // keep the body in one piece: link separate components through their closest pair
  for (;;) {
    const roots = [...new Set(pieces.map((p) => find(p.id)))]
    if (roots.length <= 1) break
    let best = null
    for (const a of pieces) for (const b of pieces) if (find(a.id) !== find(b.id)) { const g = boxGap(a.box, b.box); if (!best || g < best.g) best = { a, b, g } }
    uf.set(find(best.a.id), find(best.b.id))
    joints.push({ a: best.a.id, b: best.b.id, kind: kindOf(best.a, best.b) })
  }
  const hangers = pieces.length ? pieces : []
  for (const m of movers) {
    if (!hangers.length) break
    let best = hangers[0]
    let bg = Infinity
    for (const h of hangers) {
      const g = boxGap(m.box, h.box) * 1000 - Math.log(boxVolume(h.box))
      if (g < bg) {
        bg = g
        best = h
      }
    }
    joints.push({ a: m.id, b: best.id, kind: m.tag.joint ?? 'hinge' })
  }

  const destructible = { name: type, parts, joints, tags: ['furniture', type] }
  const animations = buildAnimations(spec, partIds, GT, new Set(movers.map((m) => m.source.id)))
  return { spec, pieces, movers, partIds, destructible, animations }
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// The module
// ---------------------------------------------------------------------------------------------------------------------------------------
/**
 * @param {{ GameInteractablesHousehold: any, GameInteractablesThree: any, fillContainers?: (THREE: any, group: any, spec: any, type: string) => void, locale?: string }} options
 * `fillContainers` puts the contents of the containers of a piece of furniture in its group (the entry gives the one that draws them as real items).
 * @returns {import('@adatechnology/game-contracts').TestableModule<any>}
 */
export function createFurnitureArea({ GameInteractablesHousehold: HHP, GameInteractablesThree: GT, fillContainers, locale: defaultLocale = 'en' }) {
  const isEn = (l) => (l ?? defaultLocale) === 'en'
  const households = {}
  const household = (loc) => {
    const key = isEn(loc) ? 'en' : 'pt-BR'
    return (households[key] ??= HHP.createHousehold({ locale: key, region: key === 'en' ? 'us' : 'br' }))
  }
  const analyses = {}
  const analysis = (loc, type) => {
    const key = `${isEn(loc) ? 'en' : 'pt-BR'}:${type}`
    return (analyses[key] ??= analyse(household(loc), type, GT))
  }
  const adapters = new WeakMap()

  function build(THREE, loc, type) {
    const a = analysis(loc, type)
    let gfx = adapters.get(THREE)
    if (!gfx) adapters.set(THREE, (gfx = GT.createThreeAdapter(THREE, { document: globalThis.document })))
    const mesh = gfx.createMeshApi({ quality: 'high', shadows: true })
    const rec = createRecorder(mesh.api)
    const spec = household(loc).build(type, { seed: 1 }, rec.api)
    rec.flush(a.pieces)
    const res = mesh.finish(spec)
    for (const l of res.lights) l.removeFromParent()
    const tagGroup = (id, material, tag) => {
      const g = res.parts[id]
      if (!g) return
      g.name = id
      g.userData.destructionMaterial = material
      g.userData.destructionPart = id
      g.userData.destructionPiece = tag.piece
      g.traverse((o) => {
        if (!o.isMesh) return
        o.name = id
        o.userData.destructionMaterial = material
        o.userData.destructionPart = id
        o.castShadow = o.userData.material !== 'glass' && o.userData.material !== 'emissive'
        o.receiveShadow = false
      })
    }
    for (const p of a.pieces) tagGroup(p.id, p.material, { id: p.id, piece: p.key })
    for (const m of a.movers) tagGroup(a.partIds.get(m.source.id), m.material, { id: m.id, piece: m.tag.piece, joint: m.tag.joint })
    // household ids can be kebab-case; the groups were named by `finish` with the original id
    res.group.name = type
    res.group.userData.furnitureType = type
    fillContainers?.(THREE, res.group, spec, type)
    return res.group
  }

  function fluidOf(loc, type, a) {
    const f = FLUIDS[type]
    if (!f) return undefined
    const basin = a.pieces.find((p) => p.material === 'ceramic') ?? a.pieces[0]
    const part = a.destructible.parts.find((p) => p.id === basin.id)
    const top = part.position[1] + part.shape.size[1] / 2
    return {
      container: {
        capacity: f.capacity,
        liquid: 'water',
        liters: f.liters,
        temperature: 18,
        shape: { kind: 'box', size: [...f.size] },
        opening: f.opening,
      },
      part: part.id,
      uses: ['pour'],
      offset: [part.position[0], round(top - f.size[1] - 0.01), part.position[2]],
    }
  }

  const area = {
    id: 'furniture_area',
    name: isEn(defaultLocale) ? 'Furniture and objects' : 'Móveis e objetos',
    group: isEn(defaultLocale) ? 'Furniture & objects' : 'Móveis e objetos',
    items(loc) {
      const hh = household(loc)
      return hh.types.map((t) => {
        const a = analysis(loc, t.id)
        const item = {
          id: t.id,
          name: t.name,
          build: (THREE) => build(THREE, loc, t.id),
          spec: a.destructible,
        }
        if (a.animations.length) item.animations = a.animations
        const fluid = fluidOf(loc, t.id, a)
        if (fluid) item.fluid = fluid
        if (!t.solid || t.group === 'window') item.movable = false
        return item
      })
    },
    scenarios: (loc) => buildScenarios(isEn(loc) ? 'en' : 'pt-BR', (type) => analysis(loc, type)),
  }
  return area
}
