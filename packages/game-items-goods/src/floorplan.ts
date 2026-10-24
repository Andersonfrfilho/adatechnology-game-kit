import { createFindsProvider } from '@adatechnology/game-items'
import type { FindsProvider, FindsProviderOptions, ItemsCatalog } from '@adatechnology/game-items'

/**
 * Which pool of the visor's `CONTEUDO` each furniture category of the floorplan packs draws from (the team's name on the right is the key of
 * `GOODS_HOUSE_POOLS.pools`). The categories are the ones of the residential MIGRATION table (`geladeira` is `fridge`, `pia` is `kitchen_cabinet`, `aereo` is
 * `overhead_cabinet`, `pia_b` is `washbasin`...). `sapateira` (shoe rack) has no category in the floorplan packs yet.
 */
export const FLOORPLAN_POOL_KEYS: Readonly<Record<string, string>> = {
  fridge: 'geladeira',
  display_fridge: 'refrig_exp',
  freezer: 'freezer',
  kitchen_cabinet: 'pia',
  overhead_cabinet: 'aereo',
  washbasin: 'pia_b',
  wardrobe: 'guarda',
  wardrobe_large: 'guarda',
  dresser: 'comoda',
  console_table: 'comoda',
  nightstand: 'criado',
  filing_cabinet: 'gaveteiro',
  pantry: 'despensa',
  tv_unit: 'rack',
  laundry_cabinet: 'armario_lav',
  laundry_shelf: 'estante_lav',
  workbench: 'bancada',
  tool_shelf: 'estante_ferr',
  mailbox: 'correio',
  trash_bin: 'lixeira',
  outdoor_bin: 'lixeira',
  china_cabinet: 'cristaleira',
}

/** The place tags the floorplan templates use (`TemplateDef.place`) that the catalog names differently. */
export const FLOORPLAN_PLACES: Readonly<Record<string, string>> = {
  shack: 'house',
  cabin: 'lodge',
  camp: 'military_base',
  triage: 'hospital',
  emergency_room: 'hospital',
  market: 'supermarket',
  metalworks: 'workshop',
}

/** The explicit pools describe dwellings (the visor draws them for houses); every other place uses the category roll of the container. */
export const POOL_PLACES: readonly string[] = ['house', 'apartment', 'lodge']

/** `poolAliases` for `createItems`: the furniture categories of the floorplan packs, as keys of the house pools. */
export const FLOORPLAN_POOL_ALIASES: Readonly<Record<string, string>> = FLOORPLAN_POOL_KEYS

/**
 * The `FindsProvider` for `engine.registerFindsProvider` (`@adatechnology/game-floorplan`): the goods catalog (made with `createGoodsItems`) answers what a
 * piece of furniture holds. The catalog must come from `createGoodsItems` (it carries the aliases of the floorplan categories). Fridges and freezers keep the
 * spoiled food of the abandoned state under their floorplan ids too.
 */
export const createGoodsFindsProvider = (catalog: ItemsCatalog, options: Omit<FindsProviderOptions, 'unknownContainers'> = {}): FindsProvider =>
  createFindsProvider(catalog, {
    placeAliases: { ...FLOORPLAN_PLACES, ...options.placeAliases },
    poolPlaces: options.poolPlaces ?? POOL_PLACES,
    unknownContainers: 'pass',
    ...(options.pools ? { pools: options.pools } : {}),
    rules: {
      ...options.rules,
      finds: { ...options.rules?.finds, pool: { ...options.rules?.finds?.pool, coldContainers: options.rules?.finds?.pool?.coldContainers ?? [...catalog.rules.finds.pool.coldContainers, 'fridge', 'display_fridge'] } },
    },
  })
