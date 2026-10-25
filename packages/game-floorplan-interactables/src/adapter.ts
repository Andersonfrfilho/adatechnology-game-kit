// Literal port of the team's `AdaptadorInterativos` (kit 0.3.0): the bridge between the plan of a house (`game-floorplan`) and the interactables kit
// (`game-interactables` + `game-interactables-household`). Pure JS logic, no three.js, no `Math.random`. The names are English; MIGRATION.md maps each old one.
//
//   const adapter = create({ GameInteractables, GameInteractablesHousehold, locale: 'pt-BR', region: 'br' })
//   const plan = adapter.plan(result, { floor })                          // pure data, nothing is drawn
//   const world = adapter.createWorld(result, { water, seed, onEvent, lightsOn }) // kit World with texts, items, loot and water network
//   adapter.add(world, plan, { build, isBlocked })                        // adds everything and fits the doors against the walls
//
// Conventions (README of the plan, "Coordinates"): x = originX + u, z = originZ + inw * v, ry = atan2(fu, inw * fv). The front of an object of the kit is its local +z,
// the same as the front (frontU, frontV) of the furniture of the plan; so the fridge against the back wall faces away from it. `inw` is 1 by default (v grows toward the back).
//
// What the adapter reads of the plan (the result of `engine.generate` with the structure pack): `items` (and `contents`, `utilities`, `floors`, `rooms`, `walls`,
// `colors`, `state`, `seed`, `template`, `structureExtras`). It never reads a global.
import { createTranslator } from './locale.js'
import type { MessageKey } from './locale.js'
import {
  CHAIR_TABLES,
  CONTENT_BY_GROUP,
  CONTENT_FALLBACK,
  CONTENT_MAP,
  DINING_CHAIR_SIDE,
  DRAWER_GROUPS,
  DRAWER_ITEMS,
  FIXTURES_OF_POINT,
  FROZEN_ITEMS,
  OBJECT_SUBSTITUTES,
  OWN_TYPES,
  TYPE_MAP,
} from './tables.js'
import type { TypeMapEntry } from './tables.js'
import type { AdapterOptions, FloorplanAdapter, Json } from './types.js'

/** Version of the team's adapter this is the port of. */
export const ADAPTER_VERSION = '0.3.0'

const r3 = (n: number): number => Math.round(n * 1000) / 1000

/** Copy of a table with the overrides applied: a `null` or `undefined` value removes the entry. */
export function mergeRegistry<T>(base: Readonly<Record<string, T>>, extra?: Readonly<Record<string, T | null | undefined>> | null): Record<string, T> {
  const out: Record<string, T> = { ...base }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value == null) delete out[key]
      else out[key] = value
    }
  }
  return out
}

/** The helpers the preference functions of a container get. */
export interface PreferenceContext {
  /** The stack goes in the freezer first (ice cream, frozen meat). */
  frozen(stack: Json): boolean
  /** Group of the stack (`food`, `tool`, ...), or null. */
  group(stack: Json): string | null
  /** The stack is underwear or socks. */
  drawerItem(stack: Json): boolean
}

/** Order of the containers of an object for a stack (the first with a free slot that fits takes the stack). */
export type Preference = (stack: Json, context: PreferenceContext) => string[]

/** Default preference by household type. */
export const PREFERENCE: Readonly<Record<string, Preference>> = Object.freeze({
  fridge: (s, c) => (c.frozen(s) ? ['freezer', 'fridge'] : ['fridge', 'freezer']),
  fridge_compact: (s, c) => (c.frozen(s) ? ['freezer', 'fridge'] : ['fridge', 'freezer']),
  kitchen_cabinet_base: (s, c) => (DRAWER_GROUPS.includes(c.group(s) as string) ? ['drawer', 'cupboard'] : ['cupboard', 'drawer']),
  wardrobe: (s, c) => (c.drawerItem(s) ? ['drawer_1', 'drawer_2', 'drawer_3', 'shelves'] : ['shelves', 'drawer_1', 'drawer_2', 'drawer_3']),
})

export function create(options: AdapterOptions = {}): FloorplanAdapter {
  const opts = options || {}
  const GI: Json = opts.GameInteractables
  const HH: Json = opts.GameInteractablesHousehold
  const locale = opts.locale || 'pt-BR'
  const msg = createTranslator(locale, opts.messages)
  if (!GI || !HH) throw new Error(msg('error.missingKit'))
  const region = opts.region || 'br'
  const hh: Json = HH.createHousehold({ locale, region })
  const householdTypes = new Set<string>(hh.types.map((t: Json) => t.id))
  const worlds = new WeakMap<object, { points: Map<string, string>; water: Json; lightsOn: Json }>() // world -> { points: Map(global fixture -> point), water }

  // ---- registries (the defaults of tables.ts, with the overrides of the game) ----
  const typeMap = mergeRegistry<TypeMapEntry>(TYPE_MAP, opts.typeMap)
  const contentMap = mergeRegistry<string>(CONTENT_MAP, opts.contentMap)
  const contentByGroup = mergeRegistry<string>(CONTENT_BY_GROUP, opts.contentByGroup)
  const chairTables = mergeRegistry<'dining' | 'office'>(CHAIR_TABLES, opts.chairTables)
  const fixturesOfPoint = mergeRegistry<readonly string[]>(FIXTURES_OF_POINT, opts.fixturesOfPoint)
  const substitutes = mergeRegistry<readonly string[]>(OBJECT_SUBSTITUTES, opts.substitutes)
  const preference = mergeRegistry<Preference>(PREFERENCE, opts.preference)
  const ownTypes = mergeRegistry<true>(OWN_TYPES, opts.ownTypes)
  const frozenItems = new Set<string>(opts.frozenItems ?? FROZEN_ITEMS)
  const drawerItems = new Set<string>(opts.drawerItems ?? DRAWER_ITEMS)
  const chairSide = opts.chairSide ?? DINING_CHAIR_SIDE
  const contentFallback = opts.contentFallback ?? CONTENT_FALLBACK
  const seedKey = (id: string): string => {
    if (!opts.seedKey) return id
    const key = opts.seedKey(id)
    return key == null ? id : key
  }

  // ---- geometry ----
  function conv(o: Json) {
    return {
      x: (u: number) => r3(o.ox + u),
      z: (v: number) => r3(o.oz + o.inw * v),
      ry: (fu: number, fv: number) => r3(Math.atan2(fu, o.inw * fv)),
      // local offset (lx, lz) of an object with rotation ry -> offset in the world (same convention as three.js)
      off: (ry: number, lx: number, lz: number): [number, number] => [Math.cos(ry) * lx + Math.sin(ry) * lz, -Math.sin(ry) * lx + Math.cos(ry) * lz],
    }
  }

  function floorYOf(res: Json, o: Json, floor: number | null | undefined): number {
    if (floor == null || floor < 0) return o.base
    const f = (res.floors || []).find((x: Json) => x.index === floor)
    return r3(o.base + (f ? f.y0 : 0))
  }

  function colorOf(res: Json, color: unknown): number | undefined {
    if (color == null) return undefined
    if (typeof color === 'number') return color
    const v = res.colors && res.colors[color as string]
    return typeof v === 'number' ? v : undefined
  }

  function paletteOf(res: Json): Json {
    const c = res.colors || {}
    const p: Json = {}
    if (c.wood != null) p.wood = c.wood
    if (c.fabric_main != null) p.fabric_main = c.fabric_main
    if (c.fabric_accent != null) p.fabric_accent = c.fabric_accent
    if (c.metal != null) p.metal = c.metal
    return p
  }

  // ---- initial state of the lights ----
  // `lightsOn`: boolean or (lampId, entry) => boolean, in the options of plan, createWorld or add (the last one wins). Without it: off, unless `night: true` in plan; then the
  // lamps of a house with a grid and electric light that is not abandoned turn on (abandoned, no grid or kerosene lamps/lanterns: off). The team read `energia.iluminacao`
  // for "electric light"; the kit says the same with the mode of the installation: `offgrid` is the kerosene lamp, the lantern and the solar lamp.
  function lightsOfState(res: Json): boolean {
    const electrical = res.utilities && res.utilities.electrical
    return res.state !== 'abandoned' && !!electrical && electrical.mode !== 'offgrid'
  }

  function initialLight(res: Json, popts: Json, id: string, entry: Json): boolean {
    const v = popts && popts.lightsOn
    if (typeof v === 'function') return !!v(id, entry)
    if (typeof v === 'boolean') return v
    return !!(popts && popts.night) && lightsOfState(res)
  }

  // ---- content ----
  const stackGroup = (s: Json): string | null => s.group ?? (opts.groupOf ? opts.groupOf(s.itemId) : null) ?? null
  const preferenceContext: PreferenceContext = {
    frozen: (s) => frozenItems.has(s.itemId),
    group: stackGroup,
    drawerItem: (s) => drawerItems.has(s.itemId),
  }

  // a stack of the plan -> item of the household catalog: the table, the household id itself, the closest by group, the fallback
  const itemOfContent = (c: Json): string => {
    const id = contentMap[c.itemId] || (hh.items[c.itemId] ? c.itemId : null) || contentByGroup[stackGroup(c) as string] || contentFallback
    return hh.items[id] ? id : contentFallback
  }

  const volume = (d: Json): number => d.size[0] * d.size[1] * d.size[2]
  const candidates = (id: string, objectType: string): string[] => {
    const def = hh.items[id]
    const siblings = Object.values<Json>(hh.items)
      .filter((i) => i.category === def.category && i.id !== id)
      .sort((a, b) => volume(a) - volume(b) || (a.id < b.id ? -1 : 1))
    return [id].concat(siblings.map((i) => i.id), (substitutes[objectType] as string[] | undefined) || [])
  }

  // Distributes the stacks of the plan into the slots of the containers (probed with the recorder, drawing nothing).
  // Every container of the object gets an explicit list (empty where nothing fit): the draw of the kit does not enter.
  function distribute(type: string, probeItem: Json, stacks: Json[] | undefined) {
    const spec = hh.build(type, probeItem, HH.createRecorder().api)
    const conts: Json[] = spec.containers || []
    const contents: Record<string, (Json | null)[]> = {}
    for (const c of conts) contents[c.id] = c.slots.map(() => null)
    const rejected: Json[] = []
    const pref = preference[type]
    for (const p of stacks || []) {
      const original = itemOfContent(p)
      const order = (pref ? pref(p, preferenceContext) : []).concat(conts.map((c) => c.id))
      let placed = false
      // the item asked for first; if it fits no slot, the smallest of the same category that fits
      for (const id of candidates(original, type)) {
        const def = hh.items[id]
        const qty = Math.max(1, Math.min(p.count || 1, (def && def.stack) || 1))
        for (const cid of order) {
          const c = conts.find((x) => x.id === cid)
          if (!c) continue
          for (let i = 0; i < c.slots.length && !placed; i++) {
            if (contents[cid]![i] || !GI.fitsSlot(id, c.slots[i], hh.items)) continue
            const data: Json = { source: p.itemId, group: p.group, pickable: p.pickable !== false }
            if (id !== original) data.substituteFor = original
            contents[cid]![i] = { type: id, qty, data }
            placed = true
          }
          if (placed) break
        }
        if (placed) break
      }
      if (!placed) rejected.push(p)
    }
    return { contents, rejected }
  }

  // ---- plan ----
  function plan(res: Json, popts: Json = {}): Json {
    popts = popts || {}
    const o = { ox: popts.originX || 0, oz: popts.originZ || 0, inw: popts.inw || 1, base: popts.base || 0 }
    const K = conv(o)
    const floorSel = popts.floor
    const externals = popts.externals !== false
    const seed = popts.seed != null ? popts.seed : res.seed
    const palette = paletteOf(res)
    const onFloor = (f: number, outdoor?: boolean): boolean => floorSel == null || f === floorSel || ((outdoor || f < 0) && externals)
    const utilities = res.utilities || {}
    const electrical = utilities.electrical || null
    const circuits: Json[] = (electrical && electrical.circuits) || []
    const contents: Json = res.contents || {}

    const result: Json = {
      version: ADAPTER_VERSION,
      template: res.template,
      seed: res.seed,
      floor: floorSel == null ? null : floorSel,
      items: [] as Json[],
      outlets: [] as string[], // ids of the wall_socket entries
      switches: [] as string[], // ids of the wall_switch entries
      lights: [] as string[], // ids of the lamps (inside and outside)
      lanterns: [] as string[], // ids of the lanterns (lantern_lamp): kerosene/gas light, no grid
      canisters: [] as string[], // ids of the small camping cylinders (gas_canister)
      serviceEntrance: null as string | null,
      panel: null as string | null, // id of the electrical_panel entry (distribution board)
      meter: null as string | null, // id of the power_meter entry (meter box on the facade or the pillar)
      conduits: [] as string[],
      cylinders: [] as Json[], // { id, stove, place }
      stoves: [] as string[],
      fixtures: [] as Json[], // { object, fixture, global, point, pointKind }
      points: {} as Record<string, string>, // global fixture -> point of the plumbing
      mapped: [] as string[], // ids of furniture of the plan that became objects of the kit (the renderer does not need to draw them)
      chairs: [] as string[], // ids of the chairs the adapter put around the tables (origin = the table, which the renderer keeps drawing)
      unmapped: {} as Record<string, number>, // "category/type" -> count
      discarded: 0, // stacks of content that fit no slot
      warnings: [] as string[],
      origin: { x: o.ox, z: o.oz, inw: o.inw, base: o.base },
    }
    const byOrigin = new Map<string, Json[]>() // id of the furniture of the plan -> entries

    const seedOf = (id: string): number => GI.hashString(String(seed) + ':' + seedKey(id))

    function push(e: Json): Json {
      result.items.push(e)
      if (!byOrigin.has(e.origin)) byOrigin.set(e.origin, [])
      byOrigin.get(e.origin)!.push(e)
      return e
    }

    function baseItem(m: Json): Json {
      const item: Json = {
        x: K.x(m.x),
        z: K.z(m.z),
        ry: m.frontU != null ? K.ry(m.frontU, m.frontV) : r3(m.ry || 0),
        w: m.w,
        d: m.d,
        h: m.h,
        y: m.y || 0,
        seed: seedOf(m.id),
        palette,
      }
      const color = colorOf(res, m.color)
      if (color != null) item.color = color
      return item
    }

    function entry(id: string, type: string, item: Json, origin: string, floor: number, extra?: Json): Json {
      return Object.assign({ id, type, item, origin, floor, floorY: floorYOf(res, o, floor), connections: {} }, extra || {})
    }

    // Stores the stacks in the first destination that takes them; what did not fit goes to the next destination. Every destination gets an explicit list (empty where
    // nothing fit: the draw of the kit does not enter). What is left at the end counts in `discarded`.
    function store(targets: [string, Json][], stacks: Json[] | undefined): void {
      let rest = stacks || []
      for (const [type, item] of targets) {
        const d = distribute(type, item, rest)
        item.contents = Object.assign(item.contents || {}, d.contents)
        rest = d.rejected
      }
      result.discarded += rest.length
    }

    // cylinders "under the counter": the plan puts them in the gap of the stove (`on` is the slot of the stove, `hidden`); what hides them is the base cabinet of the
    // nearest kitchen (kitchen_cabinet_base: the sink with a cabinet or the tv unit). The register only works with the door of that cabinet open:
    // `requires: { object, part }` (the kit carries this to InteractionSpec.requires).
    const hidden: Json[] = []
    function distRect(c: Json, x: number, z: number): number {
      const dx = x - c.item.x
      const dz = z - c.item.z
      const s = Math.sin(c.item.ry)
      const co = Math.cos(c.item.ry)
      const lx = dx * co - dz * s
      const lz = dx * s + dz * co
      return Math.hypot(Math.max(Math.abs(lx) - (c.item.w || 0) / 2, 0), Math.max(Math.abs(lz) - (c.item.d || 0) / 2, 0))
    }
    function hideCylinders(): void {
      for (const b of hidden) {
        let target: Json = null
        for (const c of result.items) {
          if (c.type !== 'kitchen_cabinet_base' || c.floor !== b.floor) continue
          const dist = distRect(c, b.item.x, b.item.z)
          if (!target || dist < target.dist) target = { c, dist }
        }
        if (!target) {
          result.warnings.push(msg('warn.cylinderNoCabinet', { id: b.id }))
          continue
        }
        // the door whose latch (toggle_part interaction of a hinge part) is nearest the cylinder, in world coordinates
        const c = target.c
        const spec = hh.build(c.type, c.item, HH.createRecorder().api)
        const sn = Math.sin(c.item.ry)
        const cs = Math.cos(c.item.ry)
        let door: Json = null
        for (const it of spec.interactions || []) {
          const pt = it.action && it.action.do === 'toggle_part' ? (spec.parts || []).find((q: Json) => q.id === it.action.part) : null
          if (!pt || pt.motion.kind !== 'hinge') continue
          const wx = c.item.x + it.pos[0] * cs + it.pos[2] * sn
          const wz = c.item.z - it.pos[0] * sn + it.pos[2] * cs
          const dist = Math.hypot(wx - b.item.x, wz - b.item.z)
          if (!door || dist < door.dist) door = { id: pt.id, dist }
        }
        if (!door) {
          result.warnings.push(msg('warn.cabinetNoDoor', { cabinet: c.id, id: b.id }))
          continue
        }
        b.item.requires = { object: c.id, part: door.id }
      }
    }

    // lantern: lights with `lightsOn` (as the lamps) or at night in a house that is not abandoned
    function initialLanternLight(id: string, e: Json): boolean {
      const v = popts.lightsOn
      if (typeof v === 'function') return !!v(id, e)
      if (typeof v === 'boolean') return v
      return !!popts.night && res.state !== 'abandoned'
    }

    // chimney of the structure pack (`structureExtras.chimney`) and the item it belongs to. The team's chimney carried the id of its fireplace or stove; the kit's has only
    // `kind` (`fireplace`, `flue`): a chimney names its item in `fireplace` / `stove` when it has them, otherwise the first fireplace (kind fireplace) or wood stove (kind flue).
    const chimney: Json = (res.structureExtras && res.structureExtras.chimney) || null
    const firstOfType = (type: string): Json => (res.items || []).find((m: Json) => typeMap[m.type] && typeMap[m.type]!.type === type)
    function chimneyOf(m: Json, role: 'fireplace' | 'stove'): Json {
      if (!chimney) return null
      const named = role === 'fireplace' ? chimney.fireplace : chimney.stove
      if (named != null) return named === m.id ? chimney : null
      const first = firstOfType(role === 'fireplace' ? 'fireplace' : 'wood_stove')
      return chimney.kind === (role === 'fireplace' ? 'fireplace' : 'flue') && first && first.id === m.id ? chimney : null
    }
    const chimneyHeight = (ch: Json): number | undefined => (ch.height != null ? ch.height : ch.top)

    // The team's `res.gas` of the campsite named the first camp stove and the first small cylinder; the kit's plan has no gas there (the stoves of the gas planner are
    // the `stove` category), so the adapter reads the same two items.
    const campStove = firstOfType('camp_stove')
    const campCylinder = firstOfType('gas_canister')

    // fireplace: the pack draws the whole fireplace (45 cm deep firebox, floor hearth and chimney breast up to the ceiling), 1.0 m deep; the plan reserves only the wall of 0.5 m.
    // Its back is against the wall: the centre moves half the difference. The smoke comes out of the top of the outside chimney (`structureExtras.chimney`), which the house
    // renderer keeps drawing.
    function planFireplace(m: Json, e: Json, item: Json): void {
      const def = hh.types.find((t: Json) => t.id === 'fireplace')
      const lack = (def.d - m.d) / 2
      item.x = r3(item.x + Math.sin(item.ry) * lack)
      item.z = r3(item.z + Math.cos(item.ry) * lack)
      const room = (res.rooms || []).find((c: Json) => c.id === m.room && c.floor === m.floor)
      const f = (res.floors || []).find((x: Json) => x.index === m.floor)
      item.h = r3((room && room.ceiling) || (f && f.ceiling) || 2.6)
      const ch = chimneyOf(m, 'fireplace')
      if (ch) {
        if (ch.material === 'stone') item.variant = 'stone'
        const cx = K.x((ch.aabb[0] + ch.aabb[2]) / 2)
        const cz = K.z((ch.aabb[1] + ch.aabb[3]) / 2)
        // top of the outside chimney, in world coordinates (y is absolute in the plan + the base)
        e.connections.chimneyTop = [cx, r3(o.base + (chimneyHeight(ch) as number)), cz]
      }
    }

    function planSimple(m: Json, map: TypeMapEntry): void {
      const item = baseItem(m)
      const dim = map.dim === 'none' ? '' : map.dim || 'wdh'
      for (const k of ['w', 'd', 'h']) if (dim.indexOf(k) < 0) delete item[k]
      if (map.dim === 'none') delete item.y
      if (map.variant) item.variant = map.variant
      // the TV of the plan is a 10 cm blade: the drawing needs at least the foot
      if (map.type === 'tv') item.d = Math.max(item.d || 0, 0.2)
      const e = entry(m.id, map.type as string, item, m.id, m.floor)
      if (contents[m.id]) store([[map.type as string, item]], contents[m.id])
      if (m.outlet) e.connections.outlet = m.outlet
      if (map.type === 'shower') e.connections.shower = m.showerHeater || { electric: false }
      if (map.type === 'stove') {
        result.stoves.push(e.id)
        e.connections.gas = m.gas || 'cylinder'
        e.connections.cylinder = m.cylinder || null
      }
      if (map.type === 'gas_bottle') result.cylinders.push({ id: e.id, stove: m.link || null, place: m.placement || null })
      if (map.type === 'gas_canister') {
        result.canisters.push(e.id)
        if (campCylinder && campCylinder.id === m.id && campStove) result.cylinders.push({ id: e.id, stove: campStove.id, place: null }) // the camp stove uses this cylinder
      }
      if (map.type === 'wood_stove') {
        // the flue of the wood stove goes out through the roof: it rises to the height of the top of the chimney (`structureExtras.chimney`, absolute y of the plan)
        const ch = chimneyOf(m, 'stove')
        if (ch && chimneyHeight(ch)) {
          const f = (res.floors || []).find((x: Json) => x.index === m.floor)
          const high = r3((chimneyHeight(ch) as number) - (f ? f.y0 : 0) - (m.y || 0))
          item.h = high
          item.flueHeight = high
        }
      }
      if (map.type === 'fireplace') planFireplace(m, e, item)
      if (map.type === 'lantern_lamp') {
        e.lit = initialLanternLight(m.id, e)
        item.on = e.lit
        result.lanterns.push(e.id)
      }
      if (map.type === 'gas_bottle' && m.placement === 'under_counter') hidden.push(e)
      push(e)
    }

    // sink: basin + base cabinet (+ wall cabinet). washbasin: bathroom basin (+ wall cabinet when there is content). rustic_sink: basin the whole width, no cabinet under it; wall cabinet only if it has content
    function planCompound(m: Json, kind: string): void {
      const ry = m.frontU != null ? K.ry(m.frontU, m.frontV) : r3(m.ry || 0)
      const cx = K.x(m.x)
      const cz = K.z(m.z)
      const part = (id: string, type: string, w: number, d: number, h: number, y: number, lx: number, lz: number): Json => {
        const [dx, dz] = K.off(ry, lx, lz)
        const item = baseItem(m)
        item.x = r3(cx + dx)
        item.z = r3(cz + dz)
        item.ry = ry
        item.w = r3(w)
        item.d = r3(d)
        item.h = r3(h)
        item.y = y
        item.seed = seedOf(id)
        return entry(id, type, item, m.id, m.floor)
      }
      const list: Json[] = []
      const overhead = contents[m.id + '#overhead']
      if (kind === 'rustic_sink') {
        const dd = Math.max(m.d, 0.56) // the drawing of the basin needs at least 56 cm of depth; it grows to the front and the back stays on the wall
        const basin = part(m.id, 'sink_kitchen', m.w, dd, m.h + 0.3, 0, 0, -(dd - m.d) / 2)
        list.push(basin)
        const over = overhead || []
        if (m.overhead !== false && over.length) {
          const wall = part(m.id + '#overhead', 'kitchen_cabinet_wall', m.w, 0.35, 0.6, 1.55, 0, -(m.d / 2) + 0.175)
          store([['kitchen_cabinet_wall', wall.item]], over)
          list.push(wall)
        }
        if (contents[m.id]) store([['sink_kitchen', basin.item]], contents[m.id])
        if (m.outlet) basin.connections.outlet = m.outlet
      } else if (kind === 'sink') {
        const width = m.w
        const basinW = width >= 1.5 ? 1.0 : Math.max(0.6, Math.min(0.8, width - 0.3))
        const rest = r3(width - basinW)
        const left = seedOf(m.id) % 2 === 0 // side of the basin, decided by the seed
        const sink = part(m.id, 'sink_kitchen', basinW, m.d, m.h + 0.25, 0, left ? -(width / 2) + basinW / 2 : width / 2 - basinW / 2, 0)
        list.push(sink)
        let cabinet: Json = null
        if (rest >= 0.35) {
          cabinet = part(m.id + '#cabinet', 'kitchen_cabinet_base', rest, m.d, m.h, 0, left ? width / 2 - rest / 2 : -(width / 2) + rest / 2, 0)
          list.push(cabinet)
        }
        if (contents[m.id]) store(cabinet ? [['kitchen_cabinet_base', cabinet.item], ['sink_kitchen', sink.item]] : [['sink_kitchen', sink.item]], contents[m.id])
        if (m.overhead !== false) {
          // y 1.55 to 2.15 m, against the back wall of the counter
          const wall = part(m.id + '#overhead', 'kitchen_cabinet_wall', width, 0.35, 0.6, 1.55, 0, -(m.d / 2) + 0.175)
          store([['kitchen_cabinet_wall', wall.item]], overhead || [])
          list.push(wall)
        }
        if (m.outlet) sink.connections.outlet = m.outlet
      } else {
        const basin = part(m.id, 'sink_bathroom', m.w, m.d, m.h + 0.2, 0, 0, 0)
        list.push(basin)
        if (contents[m.id]) {
          if (contents[m.id].length) {
            const cabinet = part(m.id + '#cabinet', 'bathroom_cabinet', Math.max(0.45, Math.min(0.6, m.w)), 0.15, 0.75, 1.3, 0, -(m.d / 2) + 0.075)
            list.push(cabinet)
            store([['bathroom_cabinet', cabinet.item], ['sink_bathroom', basin.item]], contents[m.id])
          } else {
            store([['sink_bathroom', basin.item]], [])
          }
        }
      }
      for (const e of list) push(e)
    }

    // circuit of the lamp: the one that lists it, otherwise the one of the switch that controls it, otherwise a standalone circuit (the stair light, for example)
    function circuitOfLight(id: string): string {
      const direct = circuits.find((c) => (c.lamps || []).indexOf(id) >= 0)
      if (direct) return direct.id
      const sw = ((electrical && electrical.switches) || []).find((s: Json) => (s.controls || []).indexOf(id) >= 0)
      const viaSwitch = sw && circuits.find((c) => (c.switches || []).indexOf(sw.id) >= 0)
      return viaSwitch ? viaSwitch.id : 'standalone_circuit'
    }

    function planLamp(m: Json, map: TypeMapEntry): void {
      const item = baseItem(m)
      delete item.palette
      const e = entry(m.id, 'lamp', item, m.id, m.floor, { watts: map.watts })
      e.connections.circuit = circuitOfLight(m.id)
      e.lit = initialLight(res, popts, m.id, e)
      push(e)
      result.lights.push(e.id)
    }

    // ---- furniture ----
    for (const m of res.items || []) {
      if (!onFloor(m.floor, m.outdoor)) continue
      const map = typeMap[m.type]
      if (!map) {
        const k = m.category + '/' + m.type
        result.unmapped[k] = (result.unmapped[k] || 0) + 1
        continue
      }
      result.mapped.push(m.id)
      if (map.type === 'lamp') planLamp(m, map)
      else if (map.compound) planCompound(m, map.compound)
      else planSimple(m, map)
    }

    // ---- chairs around the tables (the plan puts none) ----
    // Position in (u, v) of the plan: centre of the table + p * lx + f * lz, with f the front of the table and p = (-fv, fu) the direction of the width. The chair looks at the
    // table (the front of the kit object is the side the sitter looks at). It only goes where there is no wall and no other furniture.
    result.chairs = []
    if (opts.chairs !== false && popts.chairs !== false) {
      const blocked = blockedOf(res, { originX: o.ox, originZ: o.oz, inw: o.inw })
      const floorKind = (q: Json) => !q.decor && !q.flat && (q.y || 0) < 0.9 && q.aabb
      const placed: number[][] = []
      const free = (m: Json, cu: number, cv: number, half: number): boolean => {
        const a = [cu - half + 0.03, cv - half + 0.03, cu + half - 0.03, cv + half - 0.03]
        for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]] as const) if (blocked(K.x(cu + dx * half * 0.9), K.z(cv + dz * half * 0.9), m.floor)) return false
        for (const q of res.items || []) {
          if (q === m || !floorKind(q) || (q.floor !== m.floor && !(q.outdoor && m.outdoor))) continue
          if (a[0]! < q.aabb[2] && a[2]! > q.aabb[0] && a[1]! < q.aabb[3] && a[3]! > q.aabb[1]) return false
        }
        for (const c of placed) if (a[0]! < c[2]! && a[2]! > c[0]! && a[1]! < c[3]! && a[3]! > c[1]! && c[4] === m.floor) return false
        placed.push([a[0]!, a[1]!, a[2]!, a[3]!, m.floor])
        return true
      }
      for (const m of res.items || []) {
        const mode = chairTables[m.type]
        if (!mode || !onFloor(m.floor, m.outdoor) || m.frontU == null) continue
        const f = [m.frontU, m.frontV] as const
        const pp = [-m.frontV, m.frontU] as const
        const seats: [number, number, readonly [number, number]][] = [] // [lx, lz, direction of the look (fu, fv)]
        if (mode === 'dining') {
          const n = Math.max(1, Math.min(3, Math.floor((m.w - 0.1) / 0.55)))
          for (const side of [1, -1]) {
            for (let i = 0; i < n; i++) seats.push([(i - (n - 1) / 2) * (m.w / n), side * (m.d / 2 + 0.17), [-side * f[0], -side * f[1]]])
          }
          if (m.w >= 1.6) for (const side of [1, -1]) seats.push([side * (m.w / 2 + 0.17), 0, [-side * pp[0], -side * pp[1]]])
        } else {
          seats.push([0, m.d / 2 + 0.2, [-f[0], -f[1]]])
        }
        seats.forEach((lg, i) => {
          const cu = r3(m.x + pp[0] * lg[0] + f[0] * lg[1])
          const cv = r3(m.z + pp[1] * lg[0] + f[1] * lg[1])
          const half = mode === 'dining' ? chairSide / 2 : 0.3
          if (!free(m, cu, cv, half)) return
          const id = m.id + '#chair' + (i + 1)
          const item: Json = { x: K.x(cu), z: K.z(cv), ry: K.ry(lg[2][0], lg[2][1]), seed: seedOf(id), palette }
          if (mode !== 'dining') {
            item.w = 0.6
            item.d = 0.6
            item.h = 0.95
          }
          const e = push(entry(id, mode === 'dining' ? 'dining_chair' : 'armchair', item, m.id, m.floor))
          result.chairs.push(e.id)
        })
      }
    }

    function conduit(id: string, pts: number[][], floor: number): void {
      const x0 = K.x(pts[0]![0]!)
      const z0 = K.z(pts[0]![1]!)
      const item = {
        x: x0,
        z: z0,
        ry: 0,
        seed: seedOf(id),
        // the points of the plan already have the absolute y of the world: the object stays on the base ground and not on the floor of the storey
        points: pts.map((p) => [r3(K.x(p[0]!) - x0), p[2], r3(K.z(p[1]!) - z0)]),
      }
      const e = entry(id, 'conduit_run', item, id, floor)
      e.floorY = o.base
      push(e)
      result.conduits.push(e.id)
    }

    // ---- electrical ----
    if (electrical) {
      for (const l of electrical.outdoorLamps || []) {
        if (!onFloor(-1, true)) continue
        const e = entry(l.id, 'lamp', { x: K.x(l.u), z: K.z(l.v), ry: 0, y: l.y, seed: seedOf(l.id) }, l.id, -1, { watts: 15 })
        e.connections.circuit = circuitOfLight(l.id)
        e.lit = initialLight(res, popts, l.id, e)
        push(e)
        result.lights.push(e.id)
      }
      for (const t of electrical.outlets || []) {
        if (!onFloor(t.floor, false)) continue
        const c = circuits.find((x) => (x.outlets || []).indexOf(t.id) >= 0)
        const item: Json = { x: K.x(t.u), z: K.z(t.v), ry: K.ry(t.frontU, t.frontV), y: t.y, seed: seedOf(t.id) }
        if (c) item.circuit = c.id
        const e = entry(t.id, 'wall_socket', item, t.id, t.floor)
        e.connections.circuit = c ? c.id : null
        push(e)
        result.outlets.push(e.id)
      }
      const lights = new Set<string>(result.lights)
      for (const s of electrical.switches || []) {
        if (!onFloor(s.floor, false)) continue
        const item: Json = { x: K.x(s.u), z: K.z(s.v), ry: K.ry(s.frontU, s.frontV), y: s.y, seed: seedOf(s.id) }
        // global device ids ("object:device"): each lamp is an object with the `lamp` device
        item.controls = (s.controls || []).map((id: string) => id + ':lamp')
        const e = entry(s.id, 'wall_switch', item, s.id, s.floor)
        e.connections.controls = (s.controls || []).slice()
        e.lit = e.connections.controls.some((id: string) => (result.items.find((x: Json) => x.id === id) || {}).lit === true) // the key follows the lamps
        if (floorSel == null) for (const id of s.controls || []) if (!lights.has(id)) result.warnings.push(msg('warn.switchUnknownLamp', { id: s.id, lamp: id }))
        push(e)
        result.switches.push(e.id)
      }
      const ee = electrical.serviceEntrance
      if (ee && ee.pole && onFloor(-1, true)) {
        const drop: number[][] = ee.drop || []
        const end = drop.length ? drop[drop.length - 1]! : [ee.pole.u, ee.pole.v, 2.6]
        const px = K.x(ee.pole.u)
        const pz = K.z(ee.pole.v)
        const item: Json = {
          x: px,
          z: pz,
          ry: 0,
          h: ee.pole.h,
          seed: seedOf('service_entrance'),
          // point where the drop reaches the house, in local coordinates of the pole (absolute y)
          house: [r3(K.x(end[0]!) - px), end[2], r3(K.z(end[1]!) - pz)],
        }
        if (ee.tap || electrical.mode === 'tap') item.variant = 'gato' // illegal tap: the drop leaves the pole straight to the house, with no meter box
        const e = entry('service_entrance', 'service_entrance', item, 'service_entrance', -1)
        push(e)
        result.serviceEntrance = e.id
        if (ee.descent && ee.descent.length > 1) conduit('conduit_descent', ee.descent, -1)
      }
      // distribution board: one breaker per circuit of the plan (the label is the room); against the wall (u, v is the plane of it)
      const q = electrical.panel
      if (q && onFloor(q.floor, false)) {
        const hdq = 0.06
        const ryq = K.ry(q.frontU, q.frontV)
        const item: Json = {
          x: r3(K.x(q.u) + Math.sin(ryq) * hdq),
          z: r3(K.z(q.v) + Math.cos(ryq) * hdq),
          ry: ryq,
          y: q.y,
          seed: seedOf('panel'),
          circuits: circuits.map((c) => ({ id: c.id, label: c.room })),
        }
        if (!item.circuits.length) delete item.circuits
        const e = entry('panel', 'electrical_panel', item, 'panel', q.floor)
        push(e)
        result.panel = e.id
      }
      // meter box (on the facade or on the gate pillar), facing out
      const med = ee && ee.meter
      if (med && onFloor(-1, true)) {
        const hdm = 0.08
        const item = { x: K.x(med.u), z: r3(K.z(med.v) - o.inw * hdm), ry: K.ry(0, -1), y: med.y, seed: seedOf('meter') }
        const e = entry('meter', 'power_meter', item, 'meter', -1)
        push(e)
        result.meter = e.id
      }
      for (const ed of electrical.conduits || []) {
        if (!ed.exposed || !ed.points || ed.points.length < 2) continue
        const circ = circuits.find((c) => c.id === ed.circuit)
        const floor = circ ? circ.floor : 0
        if (!onFloor(floor, false)) continue
        conduit(ed.id, ed.points, floor)
      }
    }

    // ---- gas ----
    const piped = result.items.filter((e: Json) => e.type === 'stove' && e.connections.gas === 'piped')
    if (piped.length) {
      // the kit only knows gas in cylinders: piped gas becomes a source with no valve near the meter
      const med = utilities.gas && utilities.gas.meter
      const ref = med ? { x: K.x(med.u), z: K.z(med.v), y: med.y || 1 } : { x: piped[0].item.x, z: piped[0].item.z, y: 0.3 }
      const e = entry('piped_gas', 'gas_piped', { x: ref.x, z: ref.z, ry: 0, y: ref.y, seed: seedOf('piped_gas') }, 'piped_gas', piped[0].floor)
      e.floorY = o.base
      push(e)
      for (const f of piped) f.connections.fuel = 'piped_gas:gas'
    }
    for (const b of result.cylinders) {
      const stove = result.items.find((e: Json) => e.id === b.stove)
      if (stove) stove.connections.fuel = b.id + ':gas'
    }

    // ---- plumbing ----
    const plumbing = utilities.plumbing
    if (plumbing) {
      const isCabinet = (t: string): boolean => t === 'kitchen_cabinet_base' || t === 'kitchen_cabinet_wall' || t === 'bathroom_cabinet'
      for (const p of plumbing.points || []) {
        const target = (byOrigin.get(p.item) || []).filter((e) => !isCabinet(e.type))[0]
        if (!target) {
          if (floorSel == null) result.warnings.push(msg('warn.pointNoObject', { id: p.id, kind: p.kind, item: p.item }))
          continue
        }
        target.point = p.id
        target.connections.flowLpm = p.flowLpm
        for (const f of fixturesOfPoint[p.kind] || []) {
          result.fixtures.push({ object: target.id, fixture: f, global: target.id + ':' + f, point: p.id, pointKind: p.kind })
          result.points[target.id + ':' + f] = p.id
        }
      }
    }
    hideCylinders()
    return result
  }

  // ---- own objects of the adapter ----
  function ownSpec(entry: Json): Json {
    if (entry.type === 'lamp') {
      const dev: Json = { id: 'lamp', kind: 'lamp', watts: entry.watts || 15, on: !!entry.lit }
      if (entry.connections.circuit) dev.circuit = entry.connections.circuit
      return { type: 'lamp', devices: [dev] }
    }
    if (entry.type === 'gas_piped') return { type: 'gas_piped', fuels: [{ id: 'gas', kind: 'gas', capacity: 1000, level: 1000 }] }
    throw new Error(msg('error.unknownOwnType', { type: entry.type }))
  }

  // Wires what the plan has already decided: the outlet of the appliance, the cylinder of the stove, the circuit of the shower, the water inlet of the machine.
  function connect(entry: Json, spec: Json): Json {
    const L = entry.connections || {}
    if (entry.type === 'wall_switch') for (const p of spec.parts || []) if (p.id === 'rocker') p.t0 = entry.lit ? 1 : 0 // the key at the position of the lamps
    if (entry.type !== 'shower') {
      for (const dv of spec.devices || []) if (L.outlet && dv.socket === 'auto') dv.socket = L.outlet + ':socket'
    } else {
      const sh = L.shower || {}
      const heater = (spec.devices || []).find((d: Json) => d.id === 'heater')
      if (heater && sh.electric === false) {
        spec.devices = spec.devices.filter((d: Json) => d !== heater)
        for (const f of spec.fixtures || []) if (f.heater === 'heater') delete f.heater
      } else if (heater) {
        if (sh.powerW) heater.watts = sh.powerW
        if (L.outletCircuit) heater.circuit = L.outletCircuit
      }
    }
    if ((entry.type === 'stove' || entry.type === 'camp_stove') && L.fuel) for (const b of spec.burners || []) if (b.fuel === 'auto') b.fuel = L.fuel
    if (entry.type === 'fireplace' && L.chimneyTop) {
      // the smoke comes out of the top of the outside chimney: the world point goes back to the local coordinates of the object
      const it = entry.item
      const dx = L.chimneyTop[0] - it.x
      const dz = L.chimneyTop[2] - it.z
      const lx = Math.cos(it.ry) * dx - Math.sin(it.ry) * dz
      const lz = Math.sin(it.ry) * dx + Math.cos(it.ry) * dz
      for (const em of spec.emitters || []) if (em.kind === 'smoke') em.pos = [r3(lx), r3(L.chimneyTop[1] - entry.floorY + 0.02), r3(lz)]
    }
    if (entry.type === 'washing_machine' && entry.point) {
      // the pack already brings the water inlet (`inlet`, tied to the appliance: it runs while the cycle runs); here only the flow of the project and the network
      spec.fixtures = spec.fixtures || []
      const inlet = spec.fixtures.find((f: Json) => f.id === 'inlet')
      if (inlet) {
        if (L.flowLpm) inlet.flow = L.flowLpm
        inlet.tank = 'auto'
      } else {
        spec.fixtures.push({ id: 'inlet', kind: 'hose', outlet: [0, 0.3, -(entry.item.d || 0.6) / 2], flow: L.flowLpm || 8, tank: 'auto' })
      }
    }
    return spec
  }

  // ---- create the world ----
  function createWorld(res: Json, copts: Json = {}): Json {
    copts = copts || {}
    const info = { points: new Map<string, string>(), water: copts.water || null, lightsOn: copts.lightsOn }
    const electrical = res.utilities && res.utilities.electrical
    const world = GI.createWorld({
      locale,
      strings: hh.strings,
      items: hh.items,
      loot: hh.loot,
      seed: copts.seed != null ? copts.seed : res.seed,
      // no grid: the cabin and the off-grid campsite have no service entrance, sockets or electric lamps (lanterns do not need a grid)
      grid: copts.grid != null ? !!copts.grid : !!electrical && electrical.mode !== 'offgrid',
      onEvent: copts.onEvent,
      canInteract: copts.canInteract,
      waterSupply: {
        draw(fixtureId: string, l: number) {
          if (!info.water) return l
          const point = info.points.get(fixtureId)
          return point == null ? l : info.water.consume(point, l)
        },
      },
    })
    worlds.set(world, info)
    return world
  }

  function pointOf(world: object, fixtureId: string): string | undefined {
    const info = worlds.get(world)
    return info ? info.points.get(fixtureId) : undefined
  }

  // ---- walls -> blocked ----
  // (x, z, floor) -> true inside a wall. The gap of the doors already comes open in `walls`. `margin` shrinks the wall on each side (2 cm) so furniture against it does not count as "inside".
  function blockedOf(res: Json, bopts: Json = {}): (x: number, z: number, floor?: number | null) => boolean {
    bopts = bopts || {}
    const ox = bopts.originX || 0
    const oz = bopts.originZ || 0
    const inw = bopts.inw || 1
    const margin = bopts.margin != null ? bopts.margin : 0.02
    const segs = (res.walls || []).map((p: Json) => {
      const e = Math.max(0, p.thickness / 2 - margin)
      const u0 = Math.min(p.u0, p.u1) - (p.axis === 'u' ? 0 : e)
      const u1 = Math.max(p.u0, p.u1) + (p.axis === 'u' ? 0 : e)
      const v0 = Math.min(p.v0, p.v1) - (p.axis === 'v' ? 0 : e)
      const v1 = Math.max(p.v0, p.v1) + (p.axis === 'v' ? 0 : e)
      const za = oz + inw * v0
      const zb = oz + inw * v1
      return { floor: p.floor, x0: ox + u0, x1: ox + u1, z0: Math.min(za, zb), z1: Math.max(za, zb) }
    })
    // index by cell of 0.5 m and floor: fitSweep calls this thousands of times per object
    const CELL = 0.5
    const grid = new Map<number, Json[]>()
    const key = (a: number, i: number, j: number): number => (a * 4096 + (i + 2048)) * 4096 + (j + 2048)
    for (const s of segs) {
      for (let i = Math.floor(s.x0 / CELL); i <= Math.floor(s.x1 / CELL); i++) {
        for (let j = Math.floor(s.z0 / CELL); j <= Math.floor(s.z1 / CELL); j++) {
          const k = key(s.floor, i, j)
          if (!grid.has(k)) grid.set(k, [])
          grid.get(k)!.push(s)
        }
      }
    }
    // object of the lot (floor -1) against the house: the wall of the ground floor counts
    return function blocked(x: number, z: number, floor?: number | null): boolean {
      const a = floor == null || floor < 0 ? 0 : floor
      const list = grid.get(key(a, Math.floor(x / CELL), Math.floor(z / CELL)))
      if (!list) return false
      for (const s of list) if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) return true
      return false
    }
  }

  // ---- add ----
  function add(world: Json, planned: Json, aopts: Json = {}): Json {
    aopts = aopts || {}
    const info = worlds.get(world)
    const build = aopts.build || ((type: string, item: Json) => hh.build(type, item, HH.createRecorder().api))
    const isBlocked = aopts.isBlocked || null
    const out: Json = { added: 0, parts: [] as Json[], hinges: {} as Record<string, string>, moved: {} as Record<string, number>, warnings: [] as string[] }
    // initial state of the lights: `lightsOn` of add, otherwise the one of createWorld, otherwise what the plan decided (`entry.lit`)
    const override = aopts.lightsOn !== undefined ? aopts.lightsOn : info && info.lightsOn
    if (override !== undefined) {
      for (const e of planned.items) if (e.type === 'lamp') e.lit = typeof override === 'function' ? !!override(e.id, e) : !!override
      for (const e of planned.items) if (e.type === 'lantern_lamp') e.lit = typeof override === 'function' ? !!override(e.id, e) : !!override
      for (const e of planned.items) if (e.type === 'wall_switch') e.lit = (e.connections.controls || []).some((id: string) => (planned.items.find((x: Json) => x.id === id) || {}).lit === true)
    }
    for (const e of planned.items) if (e.type === 'lantern_lamp') e.item.on = !!e.lit // the lantern is born in the state of the plan
    let scratch: Json = null // disposable world to test the side of the hinge without drawing anything

    // Measures how much the hinge parts open (fitSweep) with a hinge side and a setback from the front, in a disposable world.
    function probe(e: Json, hinge: string | undefined, setback: number): { sum: number; min: number; n: number } {
      if (!scratch) scratch = GI.createWorld({ locale, strings: hh.strings, items: hh.items, loot: hh.loot, grid: false })
      const it = e.item
      const x = it.x + Math.sin(it.ry) * setback
      const z = it.z + Math.cos(it.ry) * setback
      const spec = hh.build(e.type, Object.assign({}, it, { hinge }), HH.createRecorder().api)
      scratch.add('__probe', spec, { x, y: e.floorY, z, ry: it.ry })
      const blocks = (px: number, pz: number): boolean => isBlocked(px, pz, e.floor)
      let sum = 0
      let min = 1
      let n = 0
      for (const p of spec.parts || []) {
        if (p.motion.kind !== 'hinge' || !(p.bounds || p.sweep)) continue
        const t = scratch.fitSweep('__probe', p.id, blocks)
        sum += t
        min = Math.min(min, t)
        n++
      }
      scratch.remove('__probe')
      return { sum, min, n }
    }

    const better = (a: { sum: number; min: number }, b: { sum: number; min: number }): boolean => a.sum > b.sum + 1e-9 || (Math.abs(a.sum - b.sum) <= 1e-9 && a.min > b.min + 1e-9)

    // Hinged doors: keeps the side where fitSweep gives the greatest t (tie: the default of the type). If a part still does not open fully, tries moving the object away from
    // the wall up to 4 cm along the front (the plan puts the furniture against the face of the wall and the corner of the lid of a bin, for example, grazes it as it turns).
    // If the default of the type opens everything fully, nothing else is tried.
    function fitDoors(e: Json): void {
      if (!isBlocked || !householdTypes.has(e.type)) return
      const standard = probe(e, undefined, 0)
      if (!standard.n || standard.min >= 1) return
      let bestSide: string | undefined
      let m = standard
      for (const side of ['left', 'right']) {
        const r = probe(e, side, 0)
        if (better(r, m)) {
          m = r
          bestSide = side
        }
      }
      if (bestSide) {
        e.item.hinge = bestSide
        out.hinges[e.id] = bestSide
      }
      if (m.min >= 1) return
      let target = { setback: 0, r: m }
      for (const setback of [0.01, 0.02, 0.03, 0.04]) {
        const r = probe(e, bestSide, setback)
        if (better(r, target.r)) target = { setback, r }
        if (r.min >= 1) break
      }
      if (target.setback > 0 && target.r.sum > m.sum + 0.2) {
        e.item.x = r3(e.item.x + Math.sin(e.item.ry) * target.setback)
        e.item.z = r3(e.item.z + Math.cos(e.item.ry) * target.setback)
        e.moved = target.setback
        out.moved[e.id] = target.setback
      }
    }

    // the circuit of the shower is the one of the outlet the plan connected to it
    for (const e of planned.items) {
      if (e.type !== 'shower' || !e.connections.outlet) continue
      const t = planned.items.find((x: Json) => x.id === e.connections.outlet)
      if (t && t.connections.circuit) e.connections.outletCircuit = t.connections.circuit
    }

    for (const e of planned.items) {
      let spec: Json
      if (ownTypes[e.type]) {
        spec = ownSpec(e)
      } else {
        fitDoors(e)
        spec = build(e.type, e.item)
        if (!spec) {
          out.warnings.push(msg('warn.buildEmpty', { id: e.id }))
          continue
        }
      }
      connect(e, spec)
      world.add(e.id, spec, { x: e.item.x, y: e.floorY, z: e.item.z, ry: e.item.ry })
      out.added++
      if (!isBlocked) continue
      for (const p of spec.parts || []) {
        if (!(p.bounds || p.sweep)) continue
        const t = world.fitSweep(e.id, p.id, (x: number, z: number) => isBlocked(x, z, e.floor))
        if (t < 1) out.parts.push({ object: e.id, part: p.id, t })
      }
    }
    if (info) for (const f of planned.fixtures) info.points.set(f.global, f.point)
    return out
  }

  return { version: ADAPTER_VERSION, household: hh, plan, createWorld, add, blockedOf, pointOf, ownSpec, registries: { typeMap, contentMap, contentByGroup, chairTables, fixturesOfPoint, substitutes, preference, ownTypes } }
}

// keeps the type import used for the key of messages in the declaration file
export type { MessageKey }
