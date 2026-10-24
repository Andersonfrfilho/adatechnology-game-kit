import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const TOOL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
export const REPO_ROOT = join(TOOL_DIR, '..', '..')
export const SPEC_DIR = join(REPO_ROOT, 'specs', '001-migracao-entregas-dos-times')

export const SOURCE_PATHS = { animals: join(SPEC_DIR, 'sources', 'animais__bichos-do-vale.js') } as const
export const PAGE_PATHS = { animals: join(SPEC_DIR, 'artefatos', '6wxuUFgg9EZxQCeAQwx4HN.html') } as const
export const DECISIONS_PATH = join(TOOL_DIR, 'decisions.json')
export const GAME_SLICE_DIR = join(SPEC_DIR, 'game-slice', 'animals')

export const OUTPUT_PATHS = {
  gaits: join(REPO_ROOT, 'packages', 'game-animals', 'src', 'data', 'gaits.json'),
  species: join(REPO_ROOT, 'packages', 'game-animals-species', 'src', 'data', 'species.json'),
} as const
