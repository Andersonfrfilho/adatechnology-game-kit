import { resolve } from 'node:path'

import { buildCatalog, staleFiles, writeCatalog } from './build'
import { GAME_SLICE_DIR } from './paths'

const args = process.argv.slice(2)
const isCheck = args.includes('--check')
const gameOutIndex = args.indexOf('--game-out')
const gameOutput = gameOutIndex >= 0 ? args[gameOutIndex + 1] : undefined
if (gameOutIndex >= 0 && !gameOutput) {
  process.stderr.write('items-catalog: --game-out needs a directory\n')
  process.exit(1)
}

const files = buildCatalog({ gameOutput: gameOutput ? resolve(gameOutput) : GAME_SLICE_DIR })

if (isCheck) {
  const stale = staleFiles(files)
  if (stale.length > 0) {
    process.stderr.write(`items-catalog: out of date, run "pnpm --filter @adatechnology/items-catalog-tool catalog":\n${stale.map((path) => `  ${path}\n`).join('')}`)
    process.exit(1)
  }
  process.stdout.write('items-catalog: up to date\n')
} else {
  writeCatalog(files)
  process.stdout.write(`items-catalog: wrote ${Object.keys(files).length} files\n`)
}
