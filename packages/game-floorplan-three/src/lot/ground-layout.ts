import type { GroundLayout, GroundZone } from '@adatechnology/game-contracts'
import type { HousePlan } from '../types.js'

export interface PlanLotPlacement {
  readonly plan: HousePlan
  readonly offset?: readonly [number, number]
  /** True when the house group is rotated by `Math.PI` around Y (`x_world = ox - u`, `z_world = oz - v`). */
  readonly flipped?: boolean
}

const SURFACE_BY_GROUND: Readonly<Record<string, string>> = {
  lawn: 'lawn',
  grass: 'lawn',
  ceramic_floor: 'tile_floor',
  tile_floor: 'tile_floor',
  paver_floor: 'paver_floor',
  cement_floor: 'concrete_slab',
  concrete_slab: 'concrete_slab',
  wood_deck: 'wood_floor',
  wood_floor: 'wood_floor',
  gravel: 'gravel',
  dirt: 'dirt',
  stone_paving: 'stone_paving',
  road: 'road',
  pond: 'pond',
}

function mapSurface(ground: string | undefined, fallback = 'lawn'): string {
  if (!ground) return fallback
  return SURFACE_BY_GROUND[ground] ?? fallback
}

function transformRect(
  rect: readonly [number, number, number, number],
  ox: number,
  oz: number,
  flipped: boolean,
): readonly [number, number, number, number] {
  if (!flipped) {
    return [rect[0] + ox, rect[1] + oz, rect[2] + ox, rect[3] + oz]
  }
  return [ox - rect[2], oz - rect[3], ox - rect[0], oz - rect[1]]
}

interface RawLot {
  readonly rect?: readonly [number, number, number, number]
  readonly zones?: readonly {
    readonly id?: string
    readonly type?: string
    readonly ground?: string
    readonly rect?: readonly [number, number, number, number]
    readonly parts?: readonly (readonly [number, number, number, number])[]
  }[]
  readonly paths?: readonly {
    readonly id?: string
    readonly type?: string
    readonly rects?: readonly (readonly [number, number, number, number])[]
  }[]
}

interface RawItem {
  readonly type?: string
  readonly category?: string
  readonly layer?: number
  readonly aabb?: readonly [number, number, number, number]
}

function zonesOfSinglePlan(plan: HousePlan, ox: number, oz: number, flipped: boolean): GroundZone[] {
  const rec = plan as Record<string, unknown>
  const w = typeof rec.w === 'number' ? rec.w : 10
  const d = typeof rec.d === 'number' ? rec.d : 8
  const lot = (rec.lot as RawLot | null | undefined) ?? undefined
  const [u0, v0, u1, v1] = lot?.rect ?? [-2, -2, w + 2, d + 2]
  const zones: GroundZone[] = [
    { rect: transformRect([u0 - 12, v0 - 9, u1 + 12, v0 - 1.8], ox, oz, flipped), surface: 'road' },
    { rect: transformRect([u0 - 12, v0 - 1.8, u1 + 12, v0], ox, oz, flipped), surface: 'paver_floor' },
    { rect: transformRect([u0, v0, u1, v1], ox, oz, flipped), surface: 'lawn' },
  ]
  for (const z of lot?.zones ?? []) {
    const surface = mapSurface(z.ground ?? z.type, 'lawn')
    const rects = z.parts && z.parts.length > 0 ? z.parts : z.rect ? [z.rect] : []
    for (const r of rects) {
      zones.push({ rect: transformRect(r, ox, oz, flipped), surface })
    }
  }
  const items = Array.isArray(rec.items) ? (rec.items as readonly RawItem[]) : []
  const groundItems = items
    .filter((item): item is RawItem & { readonly aabb: readonly [number, number, number, number] } => item.category === 'ground_cover' && Array.isArray(item.aabb))
    .slice()
    .sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0))
  for (const item of groundItems) {
    zones.push({
      rect: transformRect(item.aabb, ox, oz, flipped),
      surface: mapSurface(item.type, 'lawn'),
    })
  }
  for (const p of lot?.paths ?? []) {
    const surface = p.type === 'pedestrian' ? 'paver_floor' : 'concrete_slab'
    for (const r of p.rects ?? []) {
      zones.push({ rect: transformRect(r, ox, oz, flipped), surface })
    }
  }
  // Keep turf under the house footprint so terrain cracks (+4 mm) never poke through indoor floors at y = 0.
  zones.push({ rect: transformRect([0, 0, w, d], ox, oz, flipped), surface: 'lawn' })
  return zones
}

/**
 * Builds a `@adatechnology/game-terrain` `GroundLayout` from one or more floorplans so the host's
 * terrain engine (`@adatechnology/game-terrain-three`) renders the lot grass, street, sidewalk,
 * driveway, patio, dirt yard, and pond natively without duplicate box meshes.
 */
export function groundLayoutOfPlans(entries: readonly PlanLotPlacement[]): GroundLayout {
  const zones: GroundZone[] = []
  for (const entry of entries) {
    const [ox, oz] = entry.offset ?? [0, 0]
    zones.push(...zonesOfSinglePlan(entry.plan, ox, oz, entry.flipped === true))
  }
  return {
    surface: 'lawn',
    zones,
  }
}

export function groundLayoutOfPlan(
  plan: HousePlan,
  offset: readonly [number, number] = [0, 0],
  flipped = false,
): GroundLayout {
  return groundLayoutOfPlans([{ plan, offset, flipped }])
}
