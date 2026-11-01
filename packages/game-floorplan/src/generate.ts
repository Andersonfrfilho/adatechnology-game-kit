import { DOOR_CLEARANCE } from './constants'
import { createPlacementContext, placementKit, runPostProcess } from './context'
import { runResultExtensions } from './extensions'
import { fillRoom } from './fill'
import { overlaps, openingZones, r2 } from './geometry'
import { STREAM } from './legacy-seeds'
import { translate } from './locale'
import { buildPlan, floorsOf } from './plan'
import { hexString, palette } from './palette'
import { registries } from './registry'
import { createRng, hashString } from './rng'
import { resolveSlots } from './slots'
import { checkLot, clampOptionsToZone, resolveZone, useOf } from './zoning'
import type { FloorplanOptions, ItemColor, Json, PlacedItem, Plan, Slot, TemplateDef, ZoneAdjustment } from './types'
import type { StateContext } from './types'

export function templateOf(t: string | TemplateDef): TemplateDef {
  if (typeof t === 'string') {
    if (!registries().TEMPLATES[t]) throw new Error('Unknown template: ' + t)
    return registries().TEMPLATES[t]
  }
  return t
}

const cleanSlot = (s: Slot) => {
  const o: Json = {}
  for (const k of Object.keys(s)) if (k[0] !== '_') o[k] = s[k]
  o.cats = Object.keys(s.cats || {})
  return o
}

/** Recorded slots (resolved positions) of every storey and of the lot. */
export function slots(template: string | TemplateDef, options?: FloorplanOptions): Json[] {
  const tpl = templateOf(template)
  const o = options || {}
  const plan = buildPlan(tpl, o.w, o.d, o)
  const locale = o.locale || 'en'
  return resolveSlots(plan)
    .map(cleanSlot)
    .map((s) => (s.reason ? Object.assign(s, { reason: translate('reasons', s.reason, locale) }) : s))
}

/** Picks the house state: the requested one, else a seeded draw over the registered distribution, else `normal`. */
export function pickState(requested: string | undefined, seed: number | string): string {
  if (requested && registries().STATE_PLUGINS[requested]) return requested
  const dist = registries().stateDistribution.weights
  if (!dist) return 'normal'
  const x = createRng(seed, registries().stateDistribution.seedKey)()
  let acc = 0
  const keys = Object.keys(dist)
  for (const k of keys) {
    acc += dist[k]
    if (x < acc) return k
  }
  return keys[keys.length - 1]
}

function colorOf(m: Json, seed: number | string): number | string {
  const spec: ItemColor = m.colorSpec || registries().CATALOG[m.type]?.color || { role: 'wood' }
  if ('role' in spec) return spec.role
  if ('hex' in spec) return spec.hex
  return spec.pick[hashString(seed + '|' + (m._seedId ?? m.id)) % spec.pick.length]
}

function applyState(plan: Plan, items: PlacedItem[], ctx: ReturnType<typeof createPlacementContext>, seed: number | string, state: string): PlacedItem[] {
  const plugin = registries().STATE_PLUGINS[state]
  if (!plugin || state === 'normal') return []
  const c: StateContext = {
    plan,
    items,
    seed,
    state,
    rng: createRng(seed, plugin.seedKey ?? 'state:' + state),
    ctx,
    kit: placementKit,
    catalog: registries().CATALOG,
    wallTopHeights: registries().WALL_TOP_HEIGHTS,
  }
  return plugin.apply(c)
}

const loc = (key: string | undefined, locale: string, ns: 'labels' | 'facadeColors' = 'labels', vars?: Record<string, string | number>) => (key ? translate(ns, key, locale, vars) : key)

/** Generates a plan: building, lot, seeded item fill, decor, house state and palette. */
export function generate(template: string | TemplateDef, options?: FloorplanOptions): Json {
  const tpl = templateOf(template)
  const o = options || {}
  const seed = o.seed == null ? 1 : o.seed
  const locale = o.locale || 'en'
  let op: FloorplanOptions = Object.assign({}, o, { seed })
  const zone = resolveZone(o.zone)
  const adjustments: ZoneAdjustment[] = []
  if (zone) op = clampOptionsToZone(tpl, op, zone, adjustments)
  const plan = buildPlan(tpl, op.w, op.d, op, { zone, adjustments })
  const all = resolveSlots(plan)
  const items: PlacedItem[] = []
  const missing: { room: string; slot: string }[] = []
  for (const room of plan.rooms.concat(plan.zones)) {
    const sl = all.filter((s) => s.room === room.id && s.floor === room.floor)
    const r = fillRoom(plan, room, sl, createRng(seed, STREAM.roomPrefix + (room.seedKey ?? registries().SEED_KEYS.rooms[room.id] ?? room.id)))
    items.push(...r.items)
    missing.push(...r.missing)
  }
  const ctx = runPostProcess(plan, items, seed)
  const state = pickState(o.state, seed)
  const stateItemsAll = applyState(plan, items, ctx, seed, state)
  const colors = palette({ seed, style: plan.style, state })
  const strip = (m: Json) => {
    const x: Json = {}
    for (const k of Object.keys(m)) if (k[0] !== '_' && k !== 'colorSpec') x[k] = m[k]
    return x
  }
  const L = plan.lot
  const lot = L
    ? {
        rect: L.rect.map(r2),
        setback: r2(L.setback),
        backyard: r2(L.backyard),
        sideYard: L.sideYard,
        style: L.style,
        pool: L.pool,
        zones: plan.zones.map((z) => ({ id: z.id, type: z.type, label: z.label, name: loc(z.label, locale), parts: z.parts, ground: z.ground })),
        perimeter: L.perimeter.map((s: Json) => Object.assign({ color: 'wall' }, s)),
        gates: plan.gates.map((g) => ({ id: g.id, type: g.type, model: g.model, u: g.u, v: g.v, axis: g.axis, width: g.width, height: g.height, side: g.side, to: g.to, material: g.material, open: !!g.open, color: 'gate' })),
        paths: plan.paths.map((c) => ({ id: c.id, type: c.type, from: c.from, to: c.to, width: c.width, rects: c.rects, points: c.points })),
      }
    : null
  const facade = Object.assign({}, plan.facade, {
    color: { name: loc(colors.meta.base, locale, 'facadeColors'), key: colors.meta.base, hex: hexString(colors.facade as number) },
    roles: { facade: 'facade', detail: 'facade_detail', roof: 'roof', wall: 'wall', gate: 'gate' },
  })
  const itemsOut = items.map((m) => {
    const out = strip(m)
    out.color = colorOf(m, seed)
    return out
  })
  const stateItemsOut = stateItemsAll.map((m) => {
    const out = strip(m)
    if (m.category) out.color = colorOf(m, seed)
    return out
  })
  const result: Json = {
    template: tpl.id,
    name: translate('templates', tpl.id, locale),
    use: useOf(tpl),
    seed,
    style: plan.style,
    state,
    w: plan.w,
    d: plan.d,
    floors: plan.floors.map((f) => ({ index: f.index, label: f.name, name: f.number != null ? translate('labels', 'floor_n', locale, { n: f.number }) : loc(f.name, locale), number: f.number, y0: f.y0, ceiling: f.ceiling })),
    rooms: plan.rooms.map((c) => ({
      id: c.id,
      type: c.type,
      label: c.label,
      name: loc(c.label, locale),
      floor: c.floor,
      u0: c.parts[0][0],
      v0: c.parts[0][1],
      u1: c.parts[0][2],
      v1: c.parts[0][3],
      parts: c.parts,
      link: c.link,
      ceiling: c.ceiling || plan.floors[c.floor].ceiling,
      color: { wall: 'wall_' + c.type, floor: 'floor_' + c.type },
    })),
    walls: plan.walls,
    doors: plan.doors,
    windows: plan.windows,
    openPairs: ([] as Json[]).concat(...Object.values(plan.openPairs)),
    facade,
    lot,
    items: itemsOut,
    stateItems: stateItemsOut,
    colors,
    building: tpl.building ? tpl.building(plan.w, plan.d, op) : null,
    missing,
  }
  if (tpl.singleFloor) result.floorNumber = op.floor || 3
  result.partyWalls = tpl.partyWalls || []
  if (plan.config) result.config = plan.config
  runResultExtensions(plan, result, seed, op)
  if (zone) {
    const report = { zone: zone.id, adjustments, violations: checkLot(zone, lot, Object.assign({}, result, { rooms: plan.rooms })) }
    result.zoning = report
  }
  return result
}

const isSolid = (m: Json) => !m.flat && !m.on && (!m.decor || m.mount === 'floor')

/** Validates a result of `generate`; returns a list of messages (empty when valid). */
export function validate(result: Json, options?: { locale?: string }): string[] {
  const locale = options?.locale || result.locale || 'en'
  const t = (key: string, vars: Record<string, string | number>) => translate('messages', key, locale, vars)
  const errors: string[] = []
  const solids: Json[] = result.items.filter(isSolid)
  for (let i = 0; i < solids.length; i++)
    for (let j = i + 1; j < solids.length; j++)
      if (solids[i].floor === solids[j].floor && !solids[i].barricade && !solids[j].barricade && overlaps(solids[i].aabb, solids[j].aabb, 0.011)) errors.push(t('overlap', { a: solids[i].id, b: solids[j].id }))
  for (const m of solids) {
    if (m.barricade) continue
    for (const p of result.doors) if (p.floor === (m.outdoor ? 0 : m.floor) && p.zones.some((z: Json) => overlaps(m.aabb, z, 0.011))) errors.push(t('door_blocked', { id: m.id }))
    if (result.lot) for (const g of result.lot.gates) if (m.outdoor && openingZones(g.u, g.v, 'u', g.width, DOOR_CLEARANCE).some((z) => overlaps(m.aabb, z, 0.011))) errors.push(t('gate_blocked', { id: m.id }))
  }
  for (const f of result.missing) errors.push(t('missing_required', { room: f.room, slot: f.slot }))
  if (result.zoning) for (const v of result.zoning.violations) errors.push(t('zone_violation', { zone: result.zoning.zone, rule: v.rule, actual: v.actual, limit: v.limit }))
  return errors
}

/** Size limits and default size of a template (they can depend on options such as `tier`). */
export function limitsOf(template: string | TemplateDef, options?: FloorplanOptions) {
  const tpl = templateOf(template)
  const op = options || {}
  return { limits: tpl.limitsFn ? tpl.limitsFn(op) : tpl.limits, defaults: tpl.defaultsFn ? tpl.defaultsFn(op) : tpl.defaults }
}

export function listTemplates(locale = 'en') {
  return Object.values(registries().TEMPLATES).map((t) => {
    const a = floorsOf(t, {})
    return {
      id: t.id,
      name: translate('templates', t.id, locale),
      use: useOf(t),
      style: typeof t.style === 'function' ? t.style({}) : t.style,
      limits: t.limits,
      defaults: t.defaults,
      floors: a.length,
      floorRange: t.floorRange || null,
      lot: !!t.lot,
      options: t.options || {},
    }
  })
}

