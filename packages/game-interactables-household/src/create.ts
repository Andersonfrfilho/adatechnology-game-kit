import type { ItemCatalog, LootTables, ObjectSpec, Strings } from '@adatechnology/game-interactables'
import { GOODS_ITEMS, GOODS_PROVENANCE, GOODS_STRINGS } from '@adatechnology/game-items-goods'
import { Ctx } from './ctx'
import lootJson from './data/loot.json'
import en from './data/locales/en.json'
import ptBR from './data/locales/pt-BR.json'
import br from './data/regions/br.json'
import us from './data/regions/us.json'
import typesJson from './data/types.json'
import { conduitRun, electricalPanel, powerMeter, serviceEntrance, tv, microwave, wallSocket, wallSwitch, washingMachine } from './builders/electrical'
import { gasBottle, shower, sinkBathroom, sinkKitchen, stove, toilet, utilitySink } from './builders/kitchen'
import { armchair, bedDouble, bunkBed, bedSingle, bench, diningChair, sofa } from './builders/seating'
import { bathroomCabinet, dresser, fridge, fridgeCompact, kitchenCabinetBase, kitchenCabinetWall, nightstand, pantry, wardrobe } from './builders/storage'
import { blinds, curtain } from './builders/windows'
import { bbq, clothesline } from './builders/outdoor'
import { campChair, campStove, campTable, campfire, cooler, gasCanister, lanternLamp } from './builders/camp'
import { fireplace, outhouse, well, woodStove } from './builders/rural'
import { dogHouse, mailbox, trashBin, wheelieBin } from './builders/yard'
import type { BuilderFn, Household, HouseholdApi, HouseholdItem, HouseholdOptions, HouseholdType, HouseholdTypeDef, Region } from './types'

const BUILDERS: Record<string, BuilderFn> = {
  fridge,
  fridge_compact: fridgeCompact,
  kitchen_cabinet_base: kitchenCabinetBase,
  kitchen_cabinet_wall: kitchenCabinetWall,
  pantry,
  wardrobe,
  dresser,
  nightstand,
  bathroom_cabinet: bathroomCabinet,
  stove,
  gas_bottle: gasBottle,
  sink_kitchen: sinkKitchen,
  sink_bathroom: sinkBathroom,
  shower,
  toilet,
  utility_sink: utilitySink,
  wall_socket: wallSocket,
  wall_switch: wallSwitch,
  service_entrance: serviceEntrance,
  conduit_run: conduitRun,
  electrical_panel: electricalPanel,
  power_meter: powerMeter,
  tv,
  microwave,
  washing_machine: washingMachine,
  sofa,
  armchair,
  dining_chair: diningChair,
  bed_double: bedDouble,
  bed_single: bedSingle,
  bench,
  blinds,
  curtain,
  trash_bin: trashBin,
  wheelie_bin: wheelieBin,
  mailbox,
  dog_house: dogHouse,
  bbq,
  clothesline,
  bunk_bed: bunkBed,
  wood_stove: woodStove,
  fireplace,
  outhouse,
  well,
  cooler,
  campfire,
  camp_stove: campStove,
  gas_canister: gasCanister,
  lantern_lamp: lanternLamp,
  camp_chair: campChair,
  camp_table: campTable,
}

const DEFS = typesJson as HouseholdTypeDef[]
const HOUSEHOLD_ITEMS = GOODS_ITEMS.filter((item) => GOODS_PROVENANCE[item.id]?.household !== undefined)
const itemTexts = (locale: 'en' | 'pt-BR'): Strings => Object.fromEntries(HOUSEHOLD_ITEMS.map((item) => [`item.${item.id}`, GOODS_STRINGS[locale][`item.${item.id}`] ?? item.id]))
const STRINGS: Record<'en' | 'pt-BR', Strings> = { en: { ...(en as Strings), ...itemTexts('en') }, 'pt-BR': { ...(ptBR as Strings), ...itemTexts('pt-BR') } }
const REGIONS: Record<string, Region> = { br: br as Region, us: us as Region }

/** Items of the pack: the goods items that started as household items (their ids are kept). */
export const HOUSEHOLD_ITEM_IDS: string[] = HOUSEHOLD_ITEMS.map((item) => item.id)

/** Ids of every type in the pack. */
export const HOUSEHOLD_TYPES: string[] = DEFS.map((d) => d.id)

/** Regions that ship with the pack. */
export const HOUSEHOLD_REGIONS: string[] = Object.keys(REGIONS)

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/**
 * Creates the household content pack: type metadata, item catalog, loot tables, locale tables, region data and `build`.
 *
 * ```ts
 * const hh = createHousehold({ locale: 'pt-BR', region: 'br' })
 * const world = createWorld({ locale: 'pt-BR', strings: hh.strings, items: hh.items, loot: hh.loot })
 * world.add('fridge-1', hh.build('fridge', { seed: 1 }, api), { x: 2, y: 0, z: 3, ry: 0 })
 * ```
 */
export function createHousehold(options: HouseholdOptions = {}): Household {
  const locale = options.locale ?? 'en'
  const lang: 'en' | 'pt-BR' = locale.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en'
  const regionId = options.region ?? (lang === 'pt-BR' ? 'br' : 'us')
  const region = REGIONS[regionId]
  if (!region) throw new Error(`Unknown region "${regionId}". Known: ${HOUSEHOLD_REGIONS.join(', ')}`)
  const strings = clone(STRINGS)
  const types: HouseholdType[] = DEFS.map((d) => ({ ...d, name: strings[lang][`type.${d.id}`] ?? d.id }))
  const defs = new Map(DEFS.map((d) => [d.id, d]))
  return {
    types,
    items: clone(Object.fromEntries(HOUSEHOLD_ITEMS.map((item) => [item.id, item]))) as ItemCatalog,
    loot: clone(lootJson) as LootTables,
    strings,
    region: clone(region),
    locale: lang,
    build(type: string, item: HouseholdItem, api: HouseholdApi): ObjectSpec {
      const def = defs.get(type)
      const fn = BUILDERS[type]
      if (!def || !fn) throw new Error(`Unknown household type "${type}"`)
      const c = new Ctx(type, item, api, def, region)
      fn(c)
      return c.finish()
    },
  }
}
