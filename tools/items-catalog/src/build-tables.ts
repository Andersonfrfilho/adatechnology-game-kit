import { valueOf } from './decisions'
import { placeIdOf } from './item-ids'
import type { Sources } from './sources'

export type NamedRecord = { id: string; name: string }

export const buildCategories = ({ ite, decisions }: Sources): NamedRecord[] => [
  ...Object.keys(ite.categorias).map((code) => valueOf(decisions.categoryMap, code, 'category')),
  ...Object.keys(decisions.gameCategoryMap).map((code) => valueOf(decisions.gameCategoryMap, code, 'game category')),
]

export const buildPlaces = (sources: Sources): NamedRecord[] => Object.keys(sources.ite.locais).map((code) => valueOf(sources.decisions.placeMap, code, 'place'))

export type RarityRecord = { id: string; weight: number; isFixedOnly: boolean }

/** `weight` is the team's table; the rarities the page says are never rolled keep their table weight and are flagged. */
export const buildRarities = ({ ite, decisions, html }: Sources): RarityRecord[] => {
  const fixedOnly = html.rules.fixedOnlyRarities.value
  return Object.entries(ite.raridades).map(([code, rarity]) => {
    const id = valueOf(decisions.rarityMap, code, 'rarity')
    const isFixedOnly = rarity.peso_tabela === null || fixedOnly.toLowerCase().includes(rarity.nome)
    return { id, weight: rarity.peso_tabela ?? 0, isFixedOnly }
  })
}

export type StorageRecord = { id: string; multiplier: number; needsPower?: true; limitDays?: number; afterLimit?: number; line: number }

const LIMIT = /Por (\d+) dias; depois, ×([\d,]+)/

export const buildStorage = ({ html, decisions }: Sources): StorageRecord[] =>
  html.storage.map((row) => {
    const { id, needsPower } = valueOf(decisions.storageIds, row.label, 'storage')
    const limit = LIMIT.exec(row.note)
    return {
      id,
      multiplier: row.multiplier,
      ...(needsPower ? { needsPower: true as const } : {}),
      ...(limit ? { limitDays: Number(limit[1]), afterLimit: Number((limit[2] ?? '').replace(',', '.')) } : {}),
      line: row.line,
    }
  })

export type DepletionRecord = { places: string[]; perDay: number; floor: number }

const toFraction = (text: string, pattern: RegExp): number => Number((pattern.exec(text)?.[1] ?? '0').replace(',', '.')) / 100

export const buildDepletion = ({ ite, decisions }: Sources): DepletionRecord[] =>
  ite.saque_progressivo.map((row) => ({
    places: [...valueOf(decisions.depletionPlaces, row.lugar, 'depletion place')],
    perDay: toFraction(row.queda, /(\d+(?:,\d+)?)% por dia/),
    floor: toFraction(row.minimo, /^(\d+)%/),
  }))

export type SpawnRecord = {
  rarityWeights: Record<string, number>
  fixedOnly: string[]
  condition: Readonly<Record<string, readonly [number, number]>>
  ageShareOfShelfLife: [number, number]
  batteryCharge: readonly [number, number]
  jerrycanFill: readonly [number, number]
  floorItemsPerCell: number
  gameRarityWeights: Readonly<Record<string, number>>
}

export const buildSpawn = ({ html, game }: Sources): SpawnRecord => {
  const { rules } = html
  const [common = 0, uncommon = 0, rare = 0, veryRare = 0] = rules.rarityWeights.value
  return {
    rarityWeights: { common, uncommon, rare, very_rare: veryRare },
    fixedOnly: ['legendary', 'unique'],
    condition: rules.conditionRanges.value,
    ageShareOfShelfLife: [0, rules.spawnAgeShare.value],
    batteryCharge: rules.batteryChargeRange.value,
    jerrycanFill: rules.jerrycanFillRange.value,
    floorItemsPerCell: rules.flooredItemsPerCell.value,
    gameRarityWeights: game.rarityWeights,
  }
}

export type MeleeRecord = { id: string; reach: number; noise: number }

export const buildMelee = (sources: Sources, resolve: (reference: string) => string): MeleeRecord[] =>
  sources.ite.itens.filter((item) => item.alc !== undefined && !sources.decisions.scope[item.id]).map((item) => ({ id: resolve(item.id), reach: item.alc ?? 0, noise: item.ru ?? 0 }))

export const placesOf = (codes: readonly string[], sources: Sources): string[] => codes.map((code) => placeIdOf(code, sources))
