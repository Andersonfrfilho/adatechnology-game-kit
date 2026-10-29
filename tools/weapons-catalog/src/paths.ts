import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const TOOL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
export const REPO_ROOT = join(TOOL_DIR, '..', '..')
const SPEC_DIR = join(REPO_ROOT, 'specs', '001-migracao-entregas-dos-times')

export const SOURCE_PATHS = {
  gallery: join(SPEC_DIR, 'sources', 'armas-itens__galeria-3d-arsenal.js'),
  arsenal: join(SPEC_DIR, 'artefatos', 'NNmzTbMKsE6nuThHKuXzWd.html'),
  lab: join(SPEC_DIR, 'sources', 'efeitos__laboratorio-explosoes.js'),
  game: join(SPEC_DIR, 'artefatos', '2UG1Mhe9LqJkQKKVsJkTWR', 'jogo.js'),
} as const

export const DECISIONS_PATH = join(TOOL_DIR, 'decisions.json')
const WEAPONS_SRC = join(REPO_ROOT, 'packages', 'game-weapons', 'src', 'data')
export const OUTPUT_PATHS = {
  calibers: join(WEAPONS_SRC, 'calibers.json'),
  firearms: join(WEAPONS_SRC, 'firearms.json'),
  launchers: join(WEAPONS_SRC, 'launchers.json'),
  explosives: join(WEAPONS_SRC, 'explosives.json'),
  attachments: join(WEAPONS_SRC, 'attachments.json'),
  models: join(REPO_ROOT, 'packages', 'game-weapons-three', 'src', 'data', 'models.json'),
} as const
export const ARCHETYPES_PATH = join(WEAPONS_SRC, 'archetypes.json')
export const SDK_CALIBERS_PATH = join(WEAPONS_SRC, 'base', 'calibers.sdk.json')
