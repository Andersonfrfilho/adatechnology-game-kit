import { readFileSync } from 'node:fs'

import { beforeAll, describe, expect, it } from 'vitest'

import { createItems, DEFAULT_RULES } from '@adatechnology/game-items'
import type { ContainerDef, ItemDef } from '@adatechnology/game-items'

import { buildCatalog } from '../src/build'
import type { ItemRecord, ProvenanceRecord } from '../src/build-items'
import type { ContainerRecord } from '../src/build-containers'
import type { HousePoolsRecord } from '../src/build-house-pools'
import { buildGameSlice } from '../src/build-game-slice'
import { finalIdOf, sdkIteItems, buildIdIndex, resolveReference } from '../src/item-ids'
import { outputPath } from '../src/paths'
import type { OutputName } from '../src/paths'
import { formatDurability, parseDurability } from '../src/parse-durability'
import { formatRecipe, parseRecipe } from '../src/parse-recipe'
import type { Recipe } from '../src/parse-recipe'
import { loadSources } from '../src/sources'
import type { Sources } from '../src/sources'

const readOutput = <TValue>(name: OutputName): TValue => JSON.parse(readFileSync(outputPath(name), 'utf8')) as TValue

let sources: Sources
let items: Map<string, ItemRecord>
let provenance: Record<string, ProvenanceRecord>

beforeAll(() => {
  sources = loadSources()
  items = new Map(readOutput<ItemRecord[]>('items').map((item) => [item.id, item]))
  provenance = readOutput<Record<string, ProvenanceRecord>>('provenance')
})

const outputOf = (iteId: string): ItemRecord => {
  const item = sources.ite.itens.find((candidate) => candidate.id === iteId)
  if (!item) throw new Error(`no team item ${iteId}`)
  const record = items.get(finalIdOf(item, sources).id)
  if (!record) throw new Error(`no generated item for ${iteId}`)
  return record
}

describe('items against the team catalog', () => {
  it('has the counts the page announces', () => {
    const { ite } = sources
    expect([ite.itens.length, Object.keys(ite.categorias).length, Object.keys(ite.locais).length, Object.keys(ite.raridades).length, ite.receitas.length, ite.conteineres.length]).toEqual([257, 14, 24, 6, 33, 16])
    expect([Object.keys(ite.regioes).length, ite.especialidades_regiao.length, ite.itens.filter((item) => item.reg.length > 0).length]).toEqual([10, 10, 111])
  })

  it('carries all 257 items, or lists them as scope game', () => {
    const missing = sources.ite.itens.filter((item) => !sources.decisions.scope[item.id] && !items.has(finalIdOf(item, sources).id))
    expect(missing.map((item) => item.id)).toEqual([])
    expect(sdkIteItems(sources).length + Object.keys(sources.decisions.scope).length).toBe(257)
    for (const id of Object.keys(sources.decisions.scope)) expect(sources.ite.itens.some((item) => item.id === id)).toBe(true)
  })

  it('keeps weight, rarity, places and the optional fields equal to the source', () => {
    for (const source of sdkIteItems(sources)) {
      const record = outputOf(source.id)
      const rarityId = sources.decisions.rarityMap[source.rar]?.value
      // What the kinds filled from the real world (`estimated`, see kinds-overlay.json) is not the team's number: the team's stays checked everywhere else.
      const estimated = (record as ItemRecord & { estimated?: string[] }).estimated ?? []
      const team = (field: string): boolean => !estimated.includes(field)
      if (team('weight')) expect(record.weight, `${source.id} kg`).toBe(source.kg)
      expect(record.rarity, `${source.id} rarity`).toBe(rarityId)
      expect(record.finds?.places.length ?? 0, `${source.id} places`).toBe(source.onde.length)
      if (team('shelfLife')) expect(record.shelfLife, `${source.id} v`).toBe(source.v ?? undefined)
      expect(record.portions, `${source.id} p`).toBe(source.p)
      if (team('nutrition')) expect(record.nutrition?.satiety, `${source.id} f`).toBe(source.f)
      if (team('nutrition')) expect(record.nutrition?.hydration, `${source.id} s`).toBe(source.s)
      if (team('cookable')) expect(record.cookable ?? false, `${source.id} ck`).toBe(Boolean(source.ck))
      expect(record.protection?.bite, `${source.id} bm`).toBe(source.bm === undefined ? undefined : source.bm / 100)
      expect(record.protection?.scratch, `${source.id} ar`).toBe(source.ar === undefined ? undefined : source.ar / 100)
      expect(record.carry?.capacityKg, `${source.id} cap`).toBe(source.cap)
      expect(record.carry?.quickSlots, `${source.id} rap`).toBe(source.rap)
      expect(record.tags?.includes('craft_only') ?? false, `${source.id} craft`).toBe(source.onde.length === 0)
    }
  })

  it('reads dur back to the exact text of the source for all 257 items', () => {
    for (const source of sources.ite.itens) expect(formatDurability(parseDurability(source.dur)), source.id).toBe(source.dur)
    for (const source of sdkIteItems(sources)) expect(formatDurability(outputOf(source.id).durability), source.id).toBe(source.dur)
  })

  it('keeps ids unique and every household item either merged or carried', () => {
    const merged = new Set(Object.values(sources.decisions.merge).map((decision) => decision.value))
    for (const id of Object.keys(sources.household)) expect(items.has(id), id).toBe(true)
    for (const id of merged) expect(sources.household[id], id).toBeDefined()
    expect(items.size).toBe(sdkIteItems(sources).length + Object.keys(sources.household).length - merged.size + Object.keys(sources.decisions.extraItems).length)
    expect(Object.keys(provenance).sort()).toEqual([...items.keys()].sort())
  })

  it('gives every item a definitive English id: snake_case, none left as the team slug, extras do not shadow a team id', () => {
    for (const id of items.keys()) expect(id, id).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
    expect(Object.values(provenance).filter((row) => !['household', 'merge', 'decision'].includes(row.idSource))).toEqual([])
    const teamIds = new Set(sources.ite.itens.map((item) => item.id))
    for (const id of Object.keys(sources.decisions.extraItems)) expect(teamIds.has(id) || sources.household[id] !== undefined, `extra ${id}`).toBe(false)
    for (const teamId of Object.keys(sources.decisions.ids)) expect(sources.ite.itens.some((item) => item.id === teamId) || sources.game.extra.some((item) => item.id === teamId), teamId).toBe(true)
    expect(sources.decisions.ids.notebook?.value).toBe('laptop')
  })

  it('keeps the merges with the household one to one, and the rejected pairs out of them', () => {
    const merged = Object.values(sources.decisions.merge).map((entry) => entry.value)
    expect(new Set(merged).size).toBe(merged.length)
    for (const teamId of Object.keys(sources.decisions.merge)) expect(sources.ite.itens.some((item) => item.id === teamId), teamId).toBe(true)
    for (const [teamId, entry] of Object.entries(sources.decisions.mergeRejected)) {
      expect(sources.decisions.merge[teamId], teamId).toBeUndefined()
      expect(sources.household[entry.value], entry.value).toBeDefined()
    }
  })

  it('loads as a catalog of game-items without a single inconsistency', () => {
    const catalog = createItems({
      packs: [
        {
          id: 'goods',
          items: [...items.values()] as unknown as ItemDef[],
          categories: readOutput('categories'),
          places: readOutput('places'),
          containers: readOutput<ContainerRecord[]>('containers') as unknown as ContainerDef[],
        },
      ],
    })
    expect(catalog.list().length).toBe(items.size)
  })
})

describe('recipes', () => {
  it('reads every recipe and writes it back to the exact words of the source', () => {
    const index = buildIdIndex(sources)
    const context = { decisions: sources.decisions, resolveItem: (reference: string) => resolveReference(reference, index) }
    expect(sources.ite.receitas.length).toBe(33)
    for (const source of sources.ite.receitas) {
      const written = formatRecipe(parseRecipe(source, context), sources.decisions)
      expect(written, source.nome).toEqual({ entrada: source.entrada, ferramenta: source.ferramenta, habilidade: source.habilidade, tempo: source.tempo, resultado: source.resultado })
    }
  })

  it('resolves every item a recipe names: the 18 terms without an item became items, fluids, things of the world or traits', () => {
    for (const recipe of readOutput<Recipe[]>('recipes')) {
      expect(recipe.unresolved, recipe.id).toEqual([])
      const named = [...recipe.inputs.flatMap((input) => [...(input.item ? [input.item] : []), ...(input.any ?? [])]), ...recipe.tools.flatMap((tool) => tool.anyOf), ...('item' in recipe.output ? [recipe.output.item] : [])]
      for (const id of named) expect(items.has(id), `${recipe.id}: ${id}`).toBe(true)
    }
  })

  it('keeps what is not an item out of the item lists of a recipe', () => {
    const recipes = readOutput<Recipe[]>('recipes')
    const inputs = recipes.flatMap((recipe) => recipe.inputs)
    expect(inputs.flatMap((input) => input.world ?? []).sort()).toEqual(['cabinet', 'door', 'soil', 'table'])
    expect(inputs.filter((input) => input.fluid).map((input) => input.fluid)).toEqual(['water', 'water'])
    expect(recipes.flatMap((recipe) => recipe.tools.flatMap((tool) => tool.world ?? [])).every((station) => station === 'fire')).toBe(true)
  })
})

describe('rules read from the page', () => {
  it('has the storage table of the page as the default multipliers', () => {
    const { storage } = sources.html
    expect(storage.length).toBe(7)
    for (const row of readOutput<{ id: string; multiplier: number; needsPower?: true; limitDays?: number; afterLimit?: number; line: number }[]>('storage')) {
      const rule = DEFAULT_RULES.storage[row.id]
      expect(rule, row.id).toEqual({ multiplier: row.multiplier, ...(row.needsPower ? { needsPower: true } : {}), ...(row.limitDays ? { limitDays: row.limitDays, afterLimit: row.afterLimit } : {}) })
    }
    expect(Object.keys(DEFAULT_RULES.storage).sort()).toEqual(readOutput<{ id: string }[]>('storage').map((row) => row.id).sort())
  })

  it('matches the freshness, carry, protection and rarity numbers of DEFAULT_RULES', () => {
    const { rules } = sources.html
    expect(DEFAULT_RULES.freshness).toEqual({ stale: rules.freshnessStale.value, spoiled: rules.freshnessSpoiled.value, rotten: rules.freshnessRotten.value })
    expect(DEFAULT_RULES.carry).toEqual({ baseKg: rules.carryBase.value, perStrengthKg: rules.carryPerStrength.value, factor: rules.carryFactor.value, encumbered: rules.encumberedAt.value, overloaded: rules.overloadedAt.value })
    expect(DEFAULT_RULES.protection).toEqual({ cap: rules.protectionCap.value, wear: { bite: rules.biteWear.value, scratch: rules.scratchWear.value }, tornShare: rules.tornShare.value, repairMargin: rules.repairMargin.value })
    const [common, uncommon, rare, veryRare] = rules.rarityWeights.value
    expect(DEFAULT_RULES.rarity.weights).toMatchObject({ common, uncommon, rare, very_rare: veryRare })
    expect(DEFAULT_RULES.rarity.fixedOnly).toEqual(['legendary', 'unique'])
    expect(sources.game.rarityWeights).toEqual({ c: common, i: uncommon, r: rare, mr: veryRare })
    expect(Object.entries(sources.ite.raridades).map(([, rarity]) => rarity.peso_tabela)).toEqual([...rules.rarityWeights.value, 0.5, null])
  })

  it('quotes the page truthfully: every citation sits on its line', () => {
    const { lines, rules, storage } = sources.html
    const cited = [...Object.values(rules).map((rule) => ({ line: rule.line, quote: rule.quote })), ...storage.map((row) => ({ line: row.line, quote: row.quote }))]
    for (const { line, quote } of cited) expect(lines[line - 1], `L${line}`).toContain(quote)
  })

  it('quotes the page truthfully in decisions.json too', () => {
    const found: { line: number; quote: string }[] = []
    const walk = (value: unknown): void => {
      if (typeof value !== 'object' || value === null) return
      const { citation } = value as { citation?: { line: number; quote: string } }
      if (citation) found.push(citation)
      for (const child of Object.values(value)) walk(child)
    }
    walk(sources.decisions)
    expect(found.length).toBeGreaterThan(0)
    for (const { line, quote } of found) expect(sources.html.lines[line - 1], `L${line}`).toContain(quote)
  })

  it('keeps the battery and gasoline rules on the items the decisions name', () => {
    for (const id of sources.decisions.chargeItems.value) expect(outputOf(id).charge?.lossPerMonth).toBe(sources.html.rules.batteryLossPerMonth.value)
    for (const id of sources.decisions.fuelItems.value) expect(outputOf(id).agingFault).toEqual({ afterDays: 180, chance: 0.1 })
  })
})

describe('the game as a source', () => {
  it('has ITENS inside the team catalog with equal kg, rarity, category, places and effects', () => {
    expect(sources.game.items.length).toBe(146)
    for (const gameItem of sources.game.items) {
      const team = sources.ite.itens.find((item) => item.id === gameItem.id)
      expect(team, gameItem.id).toBeDefined()
      expect({ kg: gameItem.kg, rar: gameItem.rar, cat: gameItem.cat, onde: gameItem.onde, f: gameItem.f, s: gameItem.s, uso: gameItem.uso }).toEqual({ kg: team?.kg, rar: team?.rar, cat: team?.cat, onde: team?.onde, f: team?.f, s: team?.s, uso: team?.uso })
    }
  })

  it('has the container table of the game in containers.json, range and weights', () => {
    const containers = new Map(readOutput<ContainerRecord[]>('containers').map((container) => [container.gameKey, container]))
    for (const [key, rule] of Object.entries(sources.game.containers)) {
      const container = containers.get(key)
      expect(container, key).toBeDefined()
      expect(container?.count, key).toEqual([...rule.n])
      if (rule.cats) expect(Object.values(container?.categories ?? {}).sort()).toEqual(Object.values(rule.cats).sort())
      else expect(container?.categoriesByPlace).toBeDefined()
    }
  })

  it('writes the ammo boxes of EXTRA with the calibers of game-weapons', () => {
    const boxes = readOutput<{ kind: string; rounds?: number; teamId: string }[]>('ammo-boxes').filter((box) => box.kind === 'ammo_box')
    expect(boxes.map((box) => [box.teamId, box.rounds])).toEqual(sources.game.extra.filter((item) => item.cat === 'mun').map((item) => [item.id, item.q]))
  })
})

describe('house pools of the viewer', () => {
  it('resolves every pool type to an alias, and every alias to an item of the catalog', () => {
    const types = new Set(Object.values(sources.house.pools).flatMap((entries) => entries.map((entry) => entry.tipo)))
    expect(types.size).toBe(89)
    for (const type of types) expect(sources.decisions.aliases[type], type).toBeDefined()
    const { pools } = readOutput<HousePoolsRecord>('house-pools')
    for (const entry of Object.values(pools).flat()) expect(entry.item !== null && items.has(entry.item), entry.type).toBe(true)
  })

  it('keeps the pool shape of the viewer: 25 containers, five sharing another pool', () => {
    expect(Object.keys(sources.house.pools).length).toBe(25)
    const { pools, aliasOf } = readOutput<HousePoolsRecord>('house-pools')
    expect([Object.keys(pools).length, Object.keys(aliasOf).length]).toEqual([20, 5])
    expect(sources.house.supplyCategories).toEqual(['comida', 'agua', 'remedio', 'ferramenta'])
  })
})

describe('the game slice', () => {
  it('writes the files that belong to the game', () => {
    const index = buildIdIndex(sources)
    const files = buildGameSlice(sources, '/game', (reference) => resolveReference(reference, index).id)
    const read = (name: string): unknown => JSON.parse(files[`/game/${name}.json`] ?? 'null')
    expect((read('documents') as unknown[]).length).toBe(14)
    expect((read('damage-points') as unknown[]).length).toBe(20)
    expect((read('fixed') as unknown[]).length).toBe(Object.keys(sources.game.fixed).length)
    expect((read('faction-loot') as unknown[]).length).toBe(sources.game.factionLoot.length)
    expect((read('regions') as { regions: unknown[] }).regions.length).toBe(10)
    expect(Object.keys(read('uses') as object).length).toBeGreaterThanOrEqual(257)
  })

  it('is generated together with the catalog when asked', () => {
    expect(Object.keys(buildCatalog({ gameOutput: '/game' })).length).toBe(Object.keys(buildCatalog()).length + 7)
  })
})
