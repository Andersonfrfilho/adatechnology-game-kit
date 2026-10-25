import { ADAPTER_VERSION, PREFERENCE, create, mergeRegistry } from './adapter.js'
import { CHAIR_TABLES, CONTENT_BY_GROUP, CONTENT_MAP, TYPE_MAP } from './tables.js'

export { ADAPTER_VERSION, PREFERENCE, create, mergeRegistry } from './adapter.js'
export type { Preference, PreferenceContext } from './adapter.js'
export { createTranslator, locales } from './locale.js'
export type { MessageKey, Messages } from './locale.js'
export {
  CHAIR_TABLES,
  CONTENT_BY_GROUP,
  CONTENT_FALLBACK,
  CONTENT_MAP,
  DINING_CHAIR_SIDE,
  DRAWER_GROUPS,
  DRAWER_ITEMS,
  FIXTURES_OF_POINT,
  FROZEN_ITEMS,
  OBJECT_SUBSTITUTES,
  OWN_TYPES,
  TYPE_MAP,
} from './tables.js'
export type { TypeMapEntry } from './tables.js'
export type { AdapterOptions, FloorplanAdapter, Json, Registry } from './types.js'

/**
 * The adapter as the house renderer takes it (`interactives.adapter`): `create(options)` makes the adapter; the tables are on it too.
 * Same shape as the team's `AdaptadorInterativos` (`criar`, `MAPA_TIPOS`, `MAPA_CONTEUDO`, `CONTEUDO_POR_CATEGORIA`).
 */
export const FloorplanInteractables = { version: ADAPTER_VERSION, create, TYPE_MAP, CONTENT_MAP, CONTENT_BY_GROUP, CHAIR_TABLES, PREFERENCE, mergeRegistry }
