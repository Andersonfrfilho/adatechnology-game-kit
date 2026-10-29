import type { Decisions } from './decisions'
import type { LivingData } from './extract-living'

export type UniformedInputs = { readonly living: LivingData; readonly decisions: Decisions }

const missing = (what: string, key: string): never => {
  throw new Error(`characters-catalog: no ${what} for "${key}" in decisions.json`)
}

/** The page's own category keys (`LCAT`) in English. */
const CATEGORY_IDS: Readonly<Record<string, string>> = {
  arma: 'weapon',
  protecao: 'protection',
  equip: 'equipment',
  consumo: 'consumable',
  chave: 'key',
  documento: 'document',
  troca: 'trade',
}

const UNIQUE_RARITY = 'único'

const forceKeyOf = (decisions: Decisions, key: string): string => decisions.uniformedForces.value[key]?.id ?? missing('force', key)

export const buildForces = ({ living, decisions }: UniformedInputs): unknown[] =>
  Object.entries(decisions.uniformedForces.value).map(([key, force]) => {
    const faction = living.factions.find((entry) => entry.k === key) ?? missing('faction in FACT', key)
    return {
      id: force.id,
      region: force.region,
      name: force.name,
      color: String(faction.c).replace('#', '').toUpperCase(),
      ranks: decisions.uniformedRankLadder.value[force.id] ?? force.id,
    }
  })

const NUMBER_AFTER_GREATER_OR_EQUAL = /≥\s*(\d+)/
const OPINION_BELOW = /abaixo de\s*[−-](\d+)/

const rankRuleEnglish = (commandMinimum: string, disobeyBelow: string): string =>
  `In the game, rank decides who leads when the leader falls (the highest living rank with courage + loyalty ≥ ${commandMinimum}) and what a soldier obeys. A higher rank beats opinion, unless the soldier's opinion of the superior is below −${disobeyBelow}: then they disobey, desert or mutiny.`

export const buildRanks = ({ living, decisions }: UniformedInputs): unknown => {
  const commandMinimum = NUMBER_AFTER_GREATER_OR_EQUAL.exec(living.rankRule)?.[1] ?? missing('command threshold in RANKRULE', 'rankRule')
  const disobeyBelow = OPINION_BELOW.exec(living.rankRule)?.[1] ?? missing('opinion threshold in RANKRULE', 'rankRule')
  return {
    ladders: Object.fromEntries(
      Object.entries(decisions.uniformedRanks.value).map(([ladder, ranks]) => [ladder, ranks.map((rank, order) => ({ id: rank.id, name: rank.name, order }))]),
    ),
    rule: {
      commander: { choose: 'highest-rank-alive', minimumCourageAndLoyalty: Number(commandMinimum) },
      disobeyBelowOpinion: -Number(disobeyBelow),
      onDisobey: ['disobey', 'desert', 'mutiny'],
      text: { en: rankRuleEnglish(commandMinimum, disobeyBelow), 'pt-BR': living.rankRule },
    },
  }
}

export const buildLoadouts = ({ decisions }: UniformedInputs): unknown => decisions.uniformedLoadouts.value

type LootRow = readonly [string, string, string, string, string, string, string]

export const buildLootPools = ({ living, decisions }: UniformedInputs): unknown => {
  const pools: Record<string, unknown[]> = Object.fromEntries(Object.values(decisions.uniformedForces.value).map((force) => [force.id, []]))
  for (const row of living.loot as readonly LootRow[]) {
    const [sourceId, ptName, forceKey, category, , , rarity] = row
    if (rarity === UNIQUE_RARITY) continue
    const item = decisions.uniformedLootItems.value[sourceId] ?? missing('loot item', sourceId)
    const chance = decisions.uniformedLootChance.value[rarity] ?? missing('loot chance', rarity)
    pools[forceKeyOf(decisions, forceKey)]?.push({
      itemId: item.id,
      kind: item.kind,
      name: { en: item.name, 'pt-BR': ptName },
      category: CATEGORY_IDS[category] ?? missing('loot category', category),
      rarity,
      chance,
    })
  }
  return pools
}
