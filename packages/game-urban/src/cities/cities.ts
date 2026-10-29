import { applyPatches, mergeById, removeIds } from '@adatechnology/game-contracts'
import type { DeepPartial } from '@adatechnology/game-contracts'

import type { FillBlockOptions, BlockBuilding } from '../block'
import type { UrbanBuilder } from '../scene'
import type { TowerPreset } from '../tower'
import type { Locale } from '../neighbourhoods/types'
import { DEFAULT_DISTRICT_KINDS } from './kinds'
import { DEFAULT_CITY_PLANS } from './templates'
import type {
  Block,
  CityLayout,
  CityPlanDef,
  CityPlanInput,
  DistrictKindDef,
  FillBlockCityOptions,
  KindStats,
  LayoutOptions,
  PlanLandmark,
  ResolvedDistrict,
} from './types'

/** Highest storey count a district may have unless the game raises it. */
export const DEFAULT_MAX_FLOORS = 60
export const DEFAULT_STREET = 10
const DEFAULT_LOCALE: Locale = 'pt-BR'
const DEFAULT_STOREY_PRESETS: Readonly<Record<string, string>> = { commercial: 'office', residential: 'residential' }

export type CitiesOptions = {
  /** Most storeys any district may have, applied on top of the kinds and the districts' own numbers. Default 60. */
  maxFloors?: number
  packs?: { kinds?: readonly DistrictKindDef[]; plans?: readonly CityPlanInput[] }
  patch?: { kinds?: Record<string, DeepPartial<DistrictKindDef>>; plans?: Record<string, DeepPartial<CityPlanInput>> }
  remove?: { kinds?: readonly string[]; plans?: readonly string[] }
  /** Tower presets of the kit (storey heights by use). */
  presets: readonly TowerPreset[]
  fill(b: UrbanBuilder, g: { cx: number; cz: number; size: number; minHeight: number; maxHeight: number } & FillBlockOptions): BlockBuilding[]
}

const text = <T>(by: Record<string, T>, locale: Locale): T => (by[locale] ?? by[DEFAULT_LOCALE]) as T
const named = (name: string | Partial<Record<Locale, string>> | undefined, locale: Locale): string | undefined =>
  typeof name === 'string' || name === undefined ? name : (name[locale] ?? name[DEFAULT_LOCALE])

const mergeLists = <T extends { id: string }>(parent: readonly T[], own: readonly T[]): T[] => {
  const list = [...parent]
  for (const item of own) {
    const at = list.findIndex((p) => p.id === item.id)
    if (at >= 0) list[at] = item
    else list.push(item)
  }
  return list
}

/** City plans as data: district kinds and plans are registries; a plan resolves to a layout with the district at a point and the grid of blocks of a district. */
export function createCities(o: CitiesOptions) {
  const maxFloors = o.maxFloors ?? DEFAULT_MAX_FLOORS
  const kindEntries = mergeById(DEFAULT_DISTRICT_KINDS, o.packs?.kinds)
  applyPatches(kindEntries, o.patch?.kinds)
  removeIds(kindEntries, o.remove?.kinds)
  const planEntries = mergeById<CityPlanInput>(DEFAULT_CITY_PLANS, o.packs?.plans)
  applyPatches(planEntries, o.patch?.plans)
  removeIds(planEntries, o.remove?.plans)

  const registry = <T extends { id: string }>(entries: Map<string, T>, label: string) => ({
    ids: (): string[] => [...entries.keys()],
    list: (): T[] => [...entries.values()],
    has: (id: string): boolean => entries.has(id),
    get(id: string): T {
      const entry = entries.get(id)
      if (!entry) throw new Error(`Unknown ${label} "${id}"`)
      return entry
    },
  })
  const kinds = registry(kindEntries, 'district kind')
  const rawPlans = registry(planEntries, 'city plan')

  /** A plan with `extends` followed to the end: every field present. */
  const resolvePlan = (plan: CityPlanInput, seen: readonly string[] = []): CityPlanDef => {
    if (seen.includes(plan.id)) throw new Error(`City plan "${plan.id}" extends itself (${[...seen, plan.id].join(' > ')})`)
    const parent = plan.extends ? resolvePlan(rawPlans.get(plan.extends), [...seen, plan.id]) : undefined
    const scale = plan.scale ?? parent?.scale
    const size = plan.size ?? parent?.size
    const planText = plan.text ?? parent?.text
    if (!scale || !size || !planText) throw new Error(`City plan "${plan.id}" has no ${!scale ? 'scale' : !size ? 'size' : 'text'}`)
    return {
      id: plan.id,
      scale,
      size,
      text: planText,
      extends: plan.extends,
      districts: mergeLists(parent?.districts ?? [], plan.districts ?? []),
      lines: mergeLists(parent?.lines ?? [], plan.lines ?? []),
      landmarks: [...(parent?.landmarks ?? []), ...(plan.landmarks ?? [])],
    }
  }
  const plans = {
    ...rawPlans,
    /** The plan with everything inherited from the plans it extends. */
    resolve: (id: string): CityPlanDef => resolvePlan(rawPlans.get(id)),
  }

  const layout = (planOrId: string | CityPlanInput, options: LayoutOptions = {}): CityLayout => {
    const plan = typeof planOrId === 'string' ? plans.resolve(planOrId) : resolvePlan(planOrId)
    const locale = options.locale ?? DEFAULT_LOCALE
    const cap = Math.max(0, options.maxFloors ?? maxFloors)
    const clamp = (n: number): number => Math.min(cap, Math.max(0, n))
    const districts: ResolvedDistrict[] = plan.districts.map((d) => {
      const kind = kinds.get(d.kind)
      const kindText = text(kind.text, locale)
      const [lo, hi] = d.floors ?? kind.floors
      return {
        id: d.id,
        kind: kind.id,
        rect: d.rect,
        name: named(d.name, locale) ?? kindText.name,
        description: kindText.description,
        color: kind.color,
        zone: kind.zone,
        pattern: kind.pattern,
        floors: [clamp(lo), clamp(hi)],
        uses: d.uses ?? kind.uses,
        block: kind.block,
      }
    })
    const inside = (d: ResolvedDistrict, x: number, z: number): boolean => x >= d.rect[0] && x <= d.rect[2] && z >= d.rect[1] && z <= d.rect[3]
    const districtAt = (x: number, z: number): ResolvedDistrict | undefined => {
      for (let i = districts.length - 1; i >= 0; i--) if (inside(districts[i] as ResolvedDistrict, x, z)) return districts[i]
      return undefined
    }
    const blocks = (districtId: string, bo: { street?: number } = {}): Block[] => {
      const d = districts.find((x) => x.id === districtId)
      if (!d) throw new Error(`City plan "${plan.id}" has no district "${districtId}"`)
      const street = bo.street ?? DEFAULT_STREET
      const cell = d.block
      const side = cell - street
      if (cell <= 0 || side <= 0) return []
      const [x0, z0, x1, z1] = d.rect
      const cols = Math.floor((x1 - x0) / cell)
      const rows = Math.floor((z1 - z0) / cell)
      const ox = x0 + (x1 - x0 - cols * cell) / 2
      const oz = z0 + (z1 - z0 - rows * cell) / 2
      const found: Block[] = []
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = ox + cell * (i + 0.5)
          const z = oz + cell * (j + 0.5)
          if (districtAt(x, z)?.id !== d.id) continue
          found.push({ x, z, size: [side, side], district: d.id, building: { floors: d.floors, uses: d.uses, zone: d.zone, pattern: d.pattern } })
        }
      }
      return found
    }
    const landmarks = plan.landmarks.map((l: PlanLandmark) => {
      const { name, ...rest } = l
      const label = named(name, locale)
      return label === undefined ? rest : { ...rest, name: label }
    })
    const planText = text(plan.text, locale)
    return { id: plan.id, scale: plan.scale, size: plan.size, name: planText.name, description: planText.description, districts, lines: [...plan.lines], landmarks, districtAt, blocks }
  }

  /** Area, share of the painted map and number of districts by kind; an inner district takes its area from the one under it. */
  const stats = (l: CityLayout): KindStats[] => {
    const xs = [...new Set(l.districts.flatMap((d) => [d.rect[0], d.rect[2]]))].sort((a, b) => a - b)
    const zs = [...new Set(l.districts.flatMap((d) => [d.rect[1], d.rect[3]]))].sort((a, b) => a - b)
    const area = new Map<string, number>()
    let total = 0
    for (let i = 0; i + 1 < xs.length; i++) {
      for (let j = 0; j + 1 < zs.length; j++) {
        const x0 = xs[i] as number
        const z0 = zs[j] as number
        const w = (xs[i + 1] as number) - x0
        const d = (zs[j + 1] as number) - z0
        // the centre of a cell is strictly inside or outside every rectangle, so the edges' rule does not matter
        const owner = l.districtAt(x0 + w / 2, z0 + d / 2)
        if (!owner) continue
        area.set(owner.kind, (area.get(owner.kind) ?? 0) + w * d)
        total += w * d
      }
    }
    const count = new Map<string, number>()
    for (const d of l.districts) count.set(d.kind, (count.get(d.kind) ?? 0) + 1)
    return [...count.keys()]
      .map((kind) => ({ kind, area: area.get(kind) ?? 0, share: total > 0 ? (area.get(kind) ?? 0) / total : 0, districts: count.get(kind) ?? 0 }))
      .sort((a, b) => b.area - a.area)
  }

  /**
   * Fills a block of a layout with city buildings through `block.fill`, passing the block's own `floors` and `uses` (and `storeyPresets` / `storeyHeight` when
   * given) so `block.fill` draws the heights, the use of each building and the towers. A ground-floor shop share comes from the commercial share unless
   * given. Nothing for blocks of a kind without storeys or without a pattern.
   */
  const fillBlock = (b: UrbanBuilder, block: Block, options: FillBlockCityOptions = {}): BlockBuilding[] => {
    const { floors, uses, pattern } = block.building
    if (floors[1] <= 0 || pattern === null) return []
    const { shop, ...rest } = options
    // `minHeight` / `maxHeight` are required by the signature but unused while `floors` is given; the residential preset's storey height keeps them sensible
    const storey = options.storeyHeight ?? o.presets.find((p) => p.id === DEFAULT_STOREY_PRESETS.residential)?.storeyHeight ?? (o.presets[0]?.storeyHeight as number)
    return o.fill(b, {
      cx: block.x,
      cz: block.z,
      size: Math.min(block.size[0], block.size[1]),
      minHeight: floors[0] * storey,
      maxHeight: floors[1] * storey,
      floors: [floors[0], floors[1]],
      uses,
      shop: shop ?? uses.commercial ?? 0,
      ...rest,
    })
  }

  return { maxFloors, kinds, plans, layout, stats, fillBlock }
}

export type Cities = ReturnType<typeof createCities>
