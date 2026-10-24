import type { BodySlot, Durability, Rarity } from '@adatechnology/game-items'

import { valueOf } from './decisions'
import type { Decision, DimensionSource, ExtraItem } from './decisions'
import type { IteItem } from './extract-ite'
import { finalIdOf, placeIdOf, sdkIteItems } from './item-ids'
import type { IdSource } from './item-ids'
import { parseDurability } from './parse-durability'
import type { HouseholdItem, Sources } from './sources'

/** The items file row: an `ItemDef` of `@adatechnology/game-items`, field by field in this order. */
export type ItemRecord = {
  id: string
  category: string
  tags?: string[]
  size: [number, number, number]
  weight: number
  stack: number
  shape: string
  color: number
  rarity: Rarity
  durability?: Durability
  shelfLife?: number
  portions?: number
  cookable?: boolean
  nutrition?: { satiety?: number; hydration?: number }
  protection?: { slots: BodySlot[]; bite?: number; scratch?: number; warmth?: number }
  carry?: { capacityKg: number; weightReduction: number; quickSlots: number; wheels?: boolean }
  finds?: { places: string[] }
  charge?: { lossPerMonth: number }
  agingFault?: { afterDays: number; chance: number }
}

export type SizeSource = DimensionSource

export type ProvenanceRecord = {
  /** Set on an item that exists only because `decisions.json.extraItems` says so. */
  created?: true
  ite?: string
  household?: string
  vc3?: string[]
  game?: string[]
  idSource: IdSource
  sizeSource: SizeSource
}

export type BuiltItems = { items: ItemRecord[]; provenance: Record<string, ProvenanceRecord> }

const PERCENT = 100

const sizeOf = (id: string, sources: Sources): { size: [number, number, number]; sizeSource: SizeSource } => {
  const decided = sources.decisions.dimensions[id]
  if (!decided) throw new Error(`items-catalog: no measure for item "${id}" in decisions.json (dimensions)`)
  return { size: [...decided.value], sizeSource: decided.source }
}

const nutritionOf = (item: IteItem): ItemRecord['nutrition'] => {
  if (item.f === undefined && item.s === undefined) return undefined
  return { ...(item.f === undefined ? {} : { satiety: item.f }), ...(item.s === undefined ? {} : { hydration: item.s }) }
}

const protectionOf = (item: IteItem, sources: Sources): ItemRecord['protection'] => {
  if (item.slot === undefined) return undefined
  const scale = sources.decisions.warmthScale.value
  return {
    slots: [...valueOf(sources.decisions.slotMap, item.slot, 'body slot')],
    ...(item.bm === undefined ? {} : { bite: item.bm / PERCENT }),
    ...(item.ar === undefined ? {} : { scratch: item.ar / PERCENT }),
    ...(item.cal === undefined ? {} : { warmth: item.cal / scale }),
  }
}

const carryOf = (item: IteItem, sources: Sources): ItemRecord['carry'] => {
  if (item.cap === undefined) return undefined
  const reduction = item.red ?? 0
  const hasWheels = reduction >= sources.decisions.carryWheelsAt.value
  return {
    capacityKg: item.cap,
    weightReduction: reduction / PERCENT,
    quickSlots: item.rap ?? 0,
    ...(hasWheels ? { wheels: true } : {}),
  }
}

const tagsOf = (item: IteItem, household: HouseholdItem | undefined, sources: Sources): string[] => [
  ...(household ? [valueOf(sources.decisions.householdCategoryMap, household.category, 'household category').tag] : []),
  ...(typeof item.v === 'number' ? ['perishable'] : []),
  ...(item.onde.length === 0 ? ['craft_only'] : []),
]

const buildTeamItem = (item: IteItem, sources: Sources): { record: ItemRecord; provenance: ProvenanceRecord } => {
  const { decisions } = sources
  const { id, idSource } = finalIdOf(item, sources)
  const household = decisions.merge[item.id] ? sources.household[decisions.merge[item.id]?.value ?? ''] : undefined
  const category = valueOf(decisions.categoryMap, item.cat, 'category').id
  const { size, sizeSource } = sizeOf(id, sources)
  const tags = tagsOf(item, household, sources)
  const durability = parseDurability(item.dur)
  const record: ItemRecord = {
    id,
    category,
    ...(tags.length > 0 ? { tags } : {}),
    size,
    weight: item.kg,
    stack: household?.stack ?? decisions.stackOverrides[id]?.value ?? valueOf(decisions.stackByCategory, category, 'stack default'),
    shape: household?.shape ?? valueOf(decisions.shapeByCategory, category, 'shape default'),
    color: household?.color ?? 0x808080,
    rarity: valueOf(decisions.rarityMap, item.rar, 'rarity'),
    ...(durability ? { durability } : {}),
    ...(typeof item.v === 'number' ? { shelfLife: item.v } : {}),
    ...(item.p === undefined ? {} : { portions: item.p }),
    ...(item.ck ? { cookable: true } : {}),
  }
  const nutrition = nutritionOf(item)
  const protection = protectionOf(item, sources)
  const carry = carryOf(item, sources)
  if (nutrition) record.nutrition = nutrition
  if (protection) record.protection = protection
  if (carry) record.carry = carry
  if (item.onde.length > 0) record.finds = { places: item.onde.map((code) => placeIdOf(code, sources)) }
  if (decisions.chargeItems.value.includes(item.id)) record.charge = { lossPerMonth: sources.html.rules.batteryLossPerMonth.value }
  if (decisions.fuelItems.value.includes(item.id)) {
    record.agingFault = { afterDays: sources.html.rules.fuelFaultAfterDays.value, chance: sources.html.rules.fuelFaultChance.value }
  }
  return { record, provenance: { ite: item.id, ...(household ? { household: household.id } : {}), idSource, sizeSource } }
}

const buildHouseholdItem = (household: HouseholdItem, sources: Sources): { record: ItemRecord; provenance: ProvenanceRecord } => {
  const { category: mapped, tag } = valueOf(sources.decisions.householdCategoryMap, household.category, 'household category')
  const category = sources.decisions.householdItemCategory[household.id]?.value ?? mapped
  const record: ItemRecord = {
    id: household.id,
    category,
    tags: [tag],
    size: sizeOf(household.id, sources).size,
    weight: household.weight,
    stack: household.stack,
    shape: household.shape,
    color: household.color,
    rarity: sources.decisions.householdRarity.value,
  }
  return { record, provenance: { household: household.id, idSource: 'household', sizeSource: sizeOf(household.id, sources).sizeSource } }
}

const buildExtraItem = (id: string, { value }: Decision<ExtraItem>, sources: Sources): { record: ItemRecord; provenance: ProvenanceRecord } => {
  const { decisions } = sources
  const { size, sizeSource } = sizeOf(id, sources)
  const record: ItemRecord = {
    id,
    category: value.category,
    ...(value.tags ? { tags: [...value.tags] } : {}),
    size,
    weight: value.weight,
    stack: value.stack ?? decisions.stackOverrides[id]?.value ?? valueOf(decisions.stackByCategory, value.category, 'stack default'),
    shape: value.shape ?? valueOf(decisions.shapeByCategory, value.category, 'shape default'),
    color: value.color ?? 0x808080,
    rarity: value.rarity,
    ...(value.shelfLife === undefined ? {} : { shelfLife: value.shelfLife }),
    ...(value.portions === undefined ? {} : { portions: value.portions }),
    ...(value.nutrition ? { nutrition: { ...value.nutrition } } : {}),
    ...(value.places ? { finds: { places: [...value.places] } } : {}),
  }
  return { record, provenance: { created: true, idSource: 'decision', sizeSource } }
}

const assertUniqueIds = (items: readonly ItemRecord[]): void => {
  const seen = new Set<string>()
  for (const { id } of items) {
    if (seen.has(id)) throw new Error(`items-catalog: duplicate item id "${id}"`)
    seen.add(id)
  }
}

const withViewerAliases = (provenance: Record<string, ProvenanceRecord>, sources: Sources, resolve: (reference: string) => string): void => {
  for (const [type, decision] of Object.entries(sources.decisions.aliases)) {
    if (decision.value === null) continue
    const record = provenance[resolve(decision.value)]
    if (record) record.vc3 = [...(record.vc3 ?? []), type]
  }
}

const withGameIds = (provenance: Record<string, ProvenanceRecord>, sources: Sources): void => {
  for (const item of sources.game.items) {
    const record = Object.values(provenance).find((candidate) => candidate.ite === item.id)
    if (record) record.game = [item.id]
  }
}

export const buildItems = (sources: Sources, resolve: (reference: string) => string): BuiltItems => {
  const teamItems = sdkIteItems(sources).map((item) => buildTeamItem(item, sources))
  const mergedHouseholdIds = new Set(teamItems.flatMap(({ provenance }) => (provenance.household ? [provenance.household] : [])))
  const householdItems = Object.values(sources.household)
    .filter((household) => !mergedHouseholdIds.has(household.id))
    .map((household) => buildHouseholdItem(household, sources))
  const extraItems = Object.entries(sources.decisions.extraItems).map(([id, decision]) => buildExtraItem(id, decision, sources))
  const all = [...teamItems, ...householdItems, ...extraItems]
  assertUniqueIds(all.map(({ record }) => record))
  const provenance = Object.fromEntries(all.map(({ record, provenance: row }) => [record.id, row]))
  withViewerAliases(provenance, sources, resolve)
  withGameIds(provenance, sources)
  return { items: all.map(({ record }) => record), provenance }
}
