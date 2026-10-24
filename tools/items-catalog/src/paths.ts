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

/** Where the game slice is kept in this repository until it moves to `zombiada/content/items/`; `catalog` and `catalog:check` cover it unless `--game-out` points elsewhere. */
export const GAME_SLICE_DIR = join(SPEC_DIR, 'game-slice', 'items')

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

/** `models.json` of the 3D package: the scale of each model of the showcase. */
export const MODELS_OUTPUT_PATH = join(REPO_ROOT, 'packages', 'game-items-three', 'src', 'data', 'models.json')

export const WEAPONS_CALIBERS_PATH = join(REPO_ROOT, 'packages', 'game-weapons', 'src', 'data', 'calibers.json')

/** The checklist of which items have a 3D model and the real size of each. */
export const CHECKLIST_PATH = join(SPEC_DIR, 'itens-modelos-3d.md')
