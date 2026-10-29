import type { ContainerRecord } from './build-containers'
import type { ItemRecord, ProvenanceRecord } from './build-items'
import { valueOf } from './decisions'
import type { Sources } from './sources'

export type LocaleRecord = Record<string, string>

const nameOf = (key: string, sources: Sources): string => valueOf(sources.decisions.names, key, 'pt-BR name')

const itemName = (item: ItemRecord, provenance: ProvenanceRecord, sources: Sources): string => {
  const teamItem = provenance.ite ? sources.ite.itens.find((candidate) => candidate.id === provenance.ite) : undefined
  if (teamItem) return teamItem.n
  const key = `item.${item.id}`
  return sources.householdNames['pt-BR'][key] ?? nameOf(key, sources)
}

const categoryNames = (sources: Sources): LocaleRecord => {
  const { decisions, ite } = sources
  const teamNames = Object.entries(decisions.categoryMap).map(([code, { value }]) => [`category.${value.id}`, ite.categorias[code] ?? nameOf(`category.${value.id}`, sources)] as const)
  const gameNames = Object.values(decisions.gameCategoryMap).map(({ value }) => [`category.${value.id}`, nameOf(`category.${value.id}`, sources)] as const)
  return Object.fromEntries([...teamNames, ...gameNames])
}

const placeNames = ({ decisions, ite }: Sources): LocaleRecord =>
  Object.fromEntries(Object.entries(decisions.placeMap).map(([code, { value }]) => [`place.${value.id}`, ite.locais[code] ?? value.name]))

const rarityNames = ({ decisions, ite }: Sources): LocaleRecord =>
  Object.fromEntries(Object.entries(ite.raridades).map(([code, rarity]) => [`rarity.${valueOf(decisions.rarityMap, code, 'rarity')}`, rarity.nome]))

const recipeNames = ({ decisions, ite }: Sources): LocaleRecord =>
  Object.fromEntries(ite.receitas.map((recipe) => [`recipe.${valueOf(decisions.recipeIds, recipe.nome, 'recipe')}`, recipe.nome]))

/** The pt-BR texts of the goods pack: the team's own names where the team has them, the SDK's for the household items, `decisions.names` for the rest. */
export const buildLocale = (
  items: readonly ItemRecord[],
  provenance: Readonly<Record<string, ProvenanceRecord>>,
  containers: readonly ContainerRecord[],
  sources: Sources,
): LocaleRecord => ({
  ...Object.fromEntries(items.map((item) => [`item.${item.id}`, itemName(item, provenance[item.id] as ProvenanceRecord, sources)])),
  ...categoryNames(sources),
  ...placeNames(sources),
  ...rarityNames(sources),
  ...Object.fromEntries(containers.map((container) => [`container.${container.id}`, container.teamName ?? nameOf(`container.${container.id}`, sources)])),
  ...recipeNames(sources),
})
