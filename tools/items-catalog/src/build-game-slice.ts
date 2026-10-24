import { join } from 'node:path'

import { buildAmmoBoxes } from './build-ammo-boxes'
import { valueOf } from './decisions'
import { categoryIdOf, finalIdOf, gameIteItems, sdkIteItems } from './item-ids'
import { parseDurability } from './parse-durability'
import type { Sources } from './sources'

/** Files by absolute path, each with its exact content. */
export type GeneratedFiles = Readonly<Record<string, string>>

const serialize = (data: unknown): string => `${JSON.stringify(data, null, 2)}\n`

const rarityIdOf = (name: string, sources: Sources): string => {
  const code = Object.entries(sources.ite.raridades).find(([, rarity]) => rarity.nome === name)?.[0]
  return code === undefined ? name : valueOf(sources.decisions.rarityMap, code, 'rarity')
}

const regionIdOf = (code: string, sources: Sources): string => valueOf(sources.decisions.regionIds, code, 'region')

const buildDocuments = (sources: Sources) => {
  const stories = gameIteItems(sources).map((item) => ({
    id: finalIdOf(item, sources).id,
    teamId: item.id,
    name: item.n,
    category: valueOf(sources.decisions.categoryMap, item.cat, 'category').id,
    weight: item.kg,
    rarity: valueOf(sources.decisions.rarityMap, item.rar, 'rarity'),
    durability: parseDurability(item.dur),
    use: item.uso,
    regions: item.reg.map((code) => regionIdOf(code, sources)),
  }))
  const extras = sources.game.extra
    .filter((item) => sources.decisions.gameOnlyExtras[item.id])
    .map((item) => ({ id: item.id, teamId: item.id, name: item.n, category: categoryIdOf(item.cat, sources), weight: item.kg, rarity: valueOf(sources.decisions.rarityMap, item.rar, 'rarity'), use: item.uso }))
  return [...stories, ...extras]
}

const buildRegions = (sources: Sources) => ({
  regions: Object.entries(sources.ite.regioes).map(([code, name]) => ({ id: regionIdOf(code, sources), teamCode: code, name })),
  itemRegions: Object.fromEntries(sdkIteItems(sources).filter((item) => item.reg.length > 0).map((item) => [finalIdOf(item, sources).id, item.reg.map((code) => regionIdOf(code, sources))])),
  specialties: sources.ite.especialidades_regiao,
})

const buildUses = (sources: Sources) => ({
  ...Object.fromEntries(sources.ite.itens.map((item) => [finalIdOf(item, sources).id, item.uso])),
  ...Object.fromEntries(sources.game.extra.filter((item) => item.uso).map((item) => [item.id, item.uso])),
})

const buildDamagePoints = (sources: Sources) =>
  sources.ite.itens.filter((item) => item.dano !== undefined).map((item) => ({ id: finalIdOf(item, sources).id, damage: item.dano, critical: item.cr }))

const buildFixed = (sources: Sources, resolveGameItem: (teamId: string) => string) =>
  Object.entries(sources.game.fixed).map(([key, ids]) => {
    const [house = '', containerKey = ''] = key.split(':')
    return { house, container: valueOf(sources.decisions.gameContainers, containerKey, 'game container'), items: ids.map(resolveGameItem) }
  })

const buildFactionLoot = (sources: Sources) =>
  sources.game.factionLoot.map(([id, name, faction, category, where, effect, rarity]) => ({ id, name, faction, category, where, effect, rarity: rarityIdOf(rarity, sources) }))

const buildSupplyEvents = ({ html }: Sources) => {
  const { armyDrop, freightTrain, powerSchedule, flooredItemsPerCell } = html.rules
  return {
    armyDrop: { ...armyDrop.value, line: armyDrop.line },
    freightTrain: { ...freightTrain.value, line: freightTrain.line },
    powerSchedule: { ...powerSchedule.value, line: powerSchedule.line },
    floorItemsPerCell: { value: flooredItemsPerCell.value, line: flooredItemsPerCell.line },
  }
}

export const buildGameSlice = (sources: Sources, outputDirectory: string, resolveIte: (reference: string) => string): GeneratedFiles => {
  const ammoIds = new Map(buildAmmoBoxes(sources).map((box) => [box.teamId, box.id]))
  const resolveGameItem = (teamId: string): string => ammoIds.get(teamId) ?? resolveIte(teamId)
  const file = (name: string): string => join(outputDirectory, `${name}.json`)
  return {
    [file('documents')]: serialize(buildDocuments(sources)),
    [file('regions')]: serialize(buildRegions(sources)),
    [file('uses')]: serialize(buildUses(sources)),
    [file('damage-points')]: serialize(buildDamagePoints(sources)),
    [file('fixed')]: serialize(buildFixed(sources, resolveGameItem)),
    [file('faction-loot')]: serialize(buildFactionLoot(sources)),
    [file('supply-events')]: serialize(buildSupplyEvents(sources)),
  }
}
