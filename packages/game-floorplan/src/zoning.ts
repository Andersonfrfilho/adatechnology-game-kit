import { registries } from './registry'
import { r2 } from './geometry'
import type { FloorplanOptions, Json, Plan, TemplateDef, ZoneAdjustment, ZoneDef, ZoneViolation } from './types'

/** Registers an urban zone (zoning rules). Returns the stored definition. */
export function defineZone(zone: ZoneDef): ZoneDef {
  if (!zone || !zone.id) throw new Error('defineZone: id is required')
  registries().ZONES[zone.id] = zone
  return zone
}
export const getZone = (id: string): ZoneDef | undefined => registries().ZONES[id]
export const listZones = (): ZoneDef[] => Object.values(registries().ZONES)

/** Marks ground types (e.g. `lawn`, `dirt`) that count towards the permeable area of a lot. */
export function registerPermeableGround(...types: string[]): void {
  for (const t of types) registries().PERMEABLE_GROUNDS.add(t)
}

export function resolveZone(z: string | ZoneDef | undefined): ZoneDef | null {
  if (!z) return null
  if (typeof z === 'string') {
    const found = registries().ZONES[z]
    if (!found) throw new Error('Unknown zone: ' + z)
    return found
  }
  return z
}

export const floorsOfTemplate = (tpl: TemplateDef, op: FloorplanOptions): number => (tpl.floorsFn ? tpl.floorsFn(op) : tpl.floors || []).length

/** Declared use of a template; templates without one are treated as `residential_single`. */
export const useOf = (tpl: TemplateDef): string => tpl.use || 'residential_single'

/** Totals used by the checks: storeys, height, areas. Works on a generated result or an internal plan. */
function measure(plan: Json) {
  const floors: { index: number; y0: number; ceiling: number }[] = plan.floors
  const top = floors.reduce((m, f) => Math.max(m, f.y0 + f.ceiling), 0)
  const number = plan.floorNumber != null ? plan.floorNumber : floors.length
  const rooms: { floor: number; parts: number[][] }[] = (plan.rooms || []).filter((r: Json) => r.floor >= 0)
  const area = (r: Json) => r.parts.reduce((s: number, p: number[]) => s + (p[2] - p[0]) * (p[3] - p[1]), 0)
  const footprint = plan.w * plan.d
  const built = rooms.reduce((s, r) => s + area(r), 0)
  return { storeys: number, height: r2(top), footprint, built }
}

/**
 * Checks a generated lot against a zone and returns the violations (empty when compliant).
 * `lot` is `result.lot` (may be null for apartments), `plan` is the result of `generate`.
 */
export function checkLot(zoneIn: string | ZoneDef, lot: Json, plan: Json): ZoneViolation[] {
  const zone = resolveZone(zoneIn) as ZoneDef
  const out: ZoneViolation[] = []
  const m = measure(plan)
  const use = plan.use || 'residential_single'
  if (!zone.allowedUses.includes(use)) out.push({ rule: 'use', actual: use, limit: zone.allowedUses.join(',') })
  if (m.storeys > zone.maxFloors) out.push({ rule: 'floors', actual: m.storeys, limit: zone.maxFloors })
  if (m.height > zone.maxHeight + 1e-9) out.push({ rule: 'height', actual: m.height, limit: zone.maxHeight })
  if (!lot) return out
  const [u0, v0, u1, v1] = lot.rect as number[]
  const width = r2(u1 - u0)
  const depth = r2(v1 - v0)
  const area = width * depth
  const party: string[] = plan.partyWalls || []
  const sides = [party.includes('left') ? Infinity : lot.sideYard.left, party.includes('right') ? Infinity : lot.sideYard.right]
  const left = sides[0]
  const right = sides[1]
  if (lot.setback < zone.setbacks.front - 1e-9) out.push({ rule: 'setback_front', actual: lot.setback, limit: zone.setbacks.front })
  if (Math.min(left, right) < zone.setbacks.side - 1e-9) out.push({ rule: 'setback_side', actual: Math.min(left, right), limit: zone.setbacks.side })
  if (lot.backyard < zone.setbacks.back - 1e-9) out.push({ rule: 'setback_back', actual: lot.backyard, limit: zone.setbacks.back })
  if (area < zone.minLot - 1e-9) out.push({ rule: 'min_lot', actual: r2(area), limit: zone.minLot })
  if (width < zone.minFrontage - 1e-9) out.push({ rule: 'min_frontage', actual: width, limit: zone.minFrontage })
  const ground = m.footprint
  const coverage = ground / area
  if (coverage > zone.maxCoverage + 1e-9) out.push({ rule: 'coverage', actual: r2(coverage), limit: zone.maxCoverage })
  const far = m.built / area
  if (far > zone.maxFar + 1e-9) out.push({ rule: 'far', actual: r2(far), limit: zone.maxFar })
  let permeable = 0
  for (const z of lot.zones as Json[]) if (registries().PERMEABLE_GROUNDS.has(z.ground)) for (const p of z.parts as number[][]) permeable += (p[2] - p[0]) * (p[3] - p[1])
  const permeability = permeable / area
  if (permeability < zone.permeableMin - 1e-9) out.push({ rule: 'permeable', actual: r2(permeability), limit: zone.permeableMin })
  return out
}

/** Clamps adjustable options (`floors`) to the zone before the plan is built. */
export function clampOptionsToZone(tpl: TemplateDef, op: FloorplanOptions, zone: ZoneDef, adjustments: ZoneAdjustment[]): FloorplanOptions {
  if (tpl.singleFloor) {
    // an apartment unit: the storey it sits on must exist in a building the zone allows
    const ceiling = (tpl.floors || tpl.floorsFn?.(op) || [])[0]?.ceiling ?? 2.8
    const current = op.floor || 3
    const limit = Math.max(1, Math.min(zone.maxFloors, Math.floor(zone.maxHeight / ceiling + 1e-9)))
    if (current <= limit) return op
    adjustments.push({ field: 'floor', from: current, to: limit, reason: current > zone.maxFloors ? 'max_floors' : 'max_height' })
    return Object.assign({}, op, { floor: limit })
  }
  if (!tpl.floorRange || !tpl.floorsFn) return op
  const current = floorsOfTemplate(tpl, op)
  const floors = tpl.floorsFn(op)
  const ceiling = floors.reduce((m, f) => Math.max(m, f.ceiling), 0) || 2.8
  const byHeight = Math.max(1, Math.floor(zone.maxHeight / ceiling + 1e-9))
  const limit = Math.max(tpl.floorRange[0], Math.min(zone.maxFloors, byHeight, tpl.floorRange[1]))
  if (current <= limit) return op
  adjustments.push({ field: 'floors', from: current, to: limit, reason: current > zone.maxFloors ? 'max_floors' : 'max_height' })
  return Object.assign({}, op, { floors: limit })
}

/** Raises lot setbacks to the zone minimums. */
export function clampLotToZone(cfg: Json, zone: ZoneDef, adjustments: ZoneAdjustment[], partyWalls: string[] = []): void {
  const raise = (field: string, key: string, min: number, reason: string) => {
    if (cfg[key] < min) {
      adjustments.push({ field, from: cfg[key], to: min, reason })
      cfg[key] = min
    }
  }
  raise('frontSetback', 'frontSetback', zone.setbacks.front, 'setback_front')
  if (!partyWalls.includes('left')) raise('marginLeft', 'marginLeft', zone.setbacks.side, 'setback_side')
  if (!partyWalls.includes('right')) raise('marginRight', 'marginRight', zone.setbacks.side, 'setback_side')
  raise('backyardDepth', 'backyardDepth', zone.setbacks.back, 'setback_back')
}

export type { Plan }

/** Lot zone types whose ground can be switched to a permeable one to meet the permeability rate. */
const ADJUSTABLE_ZONES = new Set(['garden', 'backyard', 'side_yard'])

/**
 * Raises the permeable area of a lot to the zone's `permeableMin` by turning paved garden, yard
 * and side zones (largest first) into the first registered permeable ground. Reports each change.
 */
export function enforcePermeability(lot: Json, zones: Json[], zone: ZoneDef, adjustments: ZoneAdjustment[]): void {
  const target = [...registries().PERMEABLE_GROUNDS][0]
  if (!target) return
  const [u0, v0, u1, v1] = lot.rect as number[]
  const area = (u1 - u0) * (v1 - v0)
  const areaOfZone = (z: Json) => (z.parts as number[][]).reduce((s, p) => s + (p[2] - p[0]) * (p[3] - p[1]), 0)
  let permeable = zones.filter((z) => registries().PERMEABLE_GROUNDS.has(z.ground)).reduce((s, z) => s + areaOfZone(z), 0)
  if (permeable / area >= zone.permeableMin) return
  const candidates = zones.filter((z) => ADJUSTABLE_ZONES.has(z.type) && !registries().PERMEABLE_GROUNDS.has(z.ground)).sort((a, b) => areaOfZone(b) - areaOfZone(a))
  for (const z of candidates) {
    if (permeable / area >= zone.permeableMin) break
    adjustments.push({ field: 'ground:' + z.id, from: z.ground, to: target, reason: 'permeable_min' })
    z.ground = target
    permeable += areaOfZone(z)
  }
}
