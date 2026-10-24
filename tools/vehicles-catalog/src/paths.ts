import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const TOOL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
export const REPO_ROOT = join(TOOL_DIR, '..', '..')
export const SPEC_DIR = join(REPO_ROOT, 'specs', '001-migracao-entregas-dos-times')

export const SOURCE_PATHS = {
  lightFleet: join(SPEC_DIR, 'sources', 'veiculos__frota-leve.js'),
  fleetCards: join(SPEC_DIR, 'sources', 'veiculos__frota.js'),
  garage: join(SPEC_DIR, 'sources', 'veiculos__garagem.js'),
} as const

/** The Garagem artifact: the SDK, the game plugin and the fleet files, in the order its page loads them. */
export const GARAGE_ARTIFACT_DIR = join(SPEC_DIR, 'artefatos', 'Xy9QydZTRyAfwxRMjzh1aT')
export const GARAGE_ARTIFACT_PAGE = join(SPEC_DIR, 'artefatos', 'Xy9QydZTRyAfwxRMjzh1aT.html')
export const GAME_SLICE_DIR = join(SPEC_DIR, 'game-slice', 'vehicles')
export const COMPARISON_DIR = join(SPEC_DIR, 'comparacoes', 'veiculos')

const FLEET_DATA = join(REPO_ROOT, 'packages', 'game-vehicles-fleet', 'src', 'data')
export const OUTPUT_PATHS = {
  dims: join(FLEET_DATA, 'dims.json'),
  paint: join(FLEET_DATA, 'paint.json'),
  stats: join(FLEET_DATA, 'stats.json'),
  cardsPtBr: join(FLEET_DATA, 'cards.pt-BR.json'),
} as const

export const LITE_GOLDEN_PATH = join(REPO_ROOT, 'packages', 'game-vehicles-three', 'tests', 'fixtures', 'team-golden', 'lite.json')
