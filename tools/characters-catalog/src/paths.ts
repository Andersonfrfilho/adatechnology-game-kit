import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const TOOL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
export const REPO_ROOT = join(TOOL_DIR, '..', '..')
export const SPEC_DIR = join(REPO_ROOT, 'specs', '001-migracao-entregas-dos-times')
const SOURCES = join(SPEC_DIR, 'sources')
const ARTIFACTS = join(SPEC_DIR, 'artefatos')

export const SOURCE_PATHS = {
  game: join(ARTIFACTS, '2UG1Mhe9LqJkQKKVsJkTWR', 'jogo.js'),
  bestiary: join(SOURCES, 'zumbis-personagens__bestiario.js'),
  elenco: join(SOURCES, 'zumbis-personagens__elenco.js'),
  portraits: join(SOURCES, 'sobreviventes__retratos-do-vale.js'),
  livingValley: join(SOURCES, 'sobreviventes__os-vivos-do-vale.js'),
  arsenal: join(SOURCES, 'armas-itens__galeria-3d-arsenal.js'),
  hordeBench: join(SOURCES, 'jogo__bancada-de-hordas.js'),
} as const

/** The team pages (artifact HTML) the Chrome captures run. */
export const PAGE_PATHS = {
  arsenal: join(ARTIFACTS, 'C96Cxhb4bTA9bbojV4ctKH.html'),
  elenco: join(ARTIFACTS, '1N5SEWsaguU6pwm6PPHiKC.html'),
  bestiary: join(ARTIFACTS, 'X1Q11t2w24GtE2MsyYy7wr.html'),
  portraits: join(ARTIFACTS, '9djtWyfGQ5LrfwTRrL5XBd.html'),
  animals: join(ARTIFACTS, '6wxuUFgg9EZxQCeAQwx4HN.html'),
} as const

export const DECISIONS_PATH = join(TOOL_DIR, 'decisions.json')
export const GAME_SLICE_DIR = join(SPEC_DIR, 'game-slice', 'characters')
export const WEAPONS_CALIBERS_PATH = join(REPO_ROOT, 'packages', 'game-weapons', 'src', 'data', 'calibers.json')

const UNDEAD_DATA = join(REPO_ROOT, 'packages', 'game-characters-undead', 'src', 'data')
const CHARACTERS_SRC = join(REPO_ROOT, 'packages', 'game-characters', 'src')
export const OUTPUT_PATHS = {
  undeadTypes: join(UNDEAD_DATA, 'types.json'),
  undeadAges: join(UNDEAD_DATA, 'ages.json'),
  undeadOutfits: join(UNDEAD_DATA, 'outfits.json'),
  undeadInfection: join(UNDEAD_DATA, 'infection.json'),
  undeadMoments: join(UNDEAD_DATA, 'moments.json'),
  presetTeamGame: join(CHARACTERS_SRC, 'presets', 'team-game.json'),
  presetPhysical: join(CHARACTERS_SRC, 'presets', 'physical.json'),
  body: join(CHARACTERS_SRC, 'data', 'body.json'),
  segments: join(CHARACTERS_SRC, 'data', 'segments.json'),
  gait: join(CHARACTERS_SRC, 'data', 'gait.json'),
  appearance: join(CHARACTERS_SRC, 'data', 'appearance.json'),
} as const

/** Golden fixtures live where the future package will read them (`tests/fixtures/team-golden/`). */
export const fixturePath = (packageName: string, file: string): string => join(REPO_ROOT, 'packages', packageName, 'tests', 'fixtures', 'team-golden', file)
