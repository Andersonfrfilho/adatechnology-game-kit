import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const TOOL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
export const REPO_ROOT = join(TOOL_DIR, '..', '..')
const SPEC_DIR = join(REPO_ROOT, 'specs', '001-migracao-entregas-dos-times')

export const SOURCE_PATHS = {
  ite: join(SPEC_DIR, 'sources', 'armas-itens__itens-vale-cinzento.js'),
  iteHtml: join(SPEC_DIR, 'artefatos', 'NKmkGZ2Lvcd96mp6Nyksds.html'),
  game: join(SPEC_DIR, 'artefatos', '2UG1Mhe9LqJkQKKVsJkTWR', 'jogo.js'),
  houseViewer: join(SPEC_DIR, 'sources', 'jogo__visor-casas-3d.js'),
} as const

export const DECISIONS_PATH = join(TOOL_DIR, 'decisions.json')
export const HOUSEHOLD_ITEMS_PATH = join(TOOL_DIR, 'base', 'household-items.sdk.json')
export const HOUSEHOLD_NAMES_PATH = join(TOOL_DIR, 'base', 'household-item-names.json')

const GOODS_DATA = join(REPO_ROOT, 'packages', 'game-items-goods', 'src', 'data')
export const OUTPUT_FILE_NAMES = [
  'items',
  'categories',
  'places',
  'rarities',
  'storage',
  'recipes',
  'containers',
  'depletion',
  'spawn',
  'house-pools',
  'ammo-boxes',
  'use-effects',
  'melee',
  'provenance',
  'locales/pt-BR',
] as const
export type OutputName = (typeof OUTPUT_FILE_NAMES)[number]
export const outputPath = (name: OutputName): string => join(GOODS_DATA, `${name}.json`)

export const WEAPONS_CALIBERS_PATH = join(REPO_ROOT, 'packages', 'game-weapons', 'src', 'data', 'calibers.json')
