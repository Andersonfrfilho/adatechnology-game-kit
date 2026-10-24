import { buildCatalog, buildGameSlice, staleFiles, writeFiles } from './build'

const isCheck = process.argv.includes('--check')
const wantsGameSlice = process.argv.includes('--game-out')
const files = wantsGameSlice ? buildGameSlice() : buildCatalog()
const command = 'pnpm --filter @adatechnology/characters-catalog-tool'

if (isCheck) {
  const stale = staleFiles(files)
  if (stale.length > 0) {
    process.stderr.write(`characters-catalog: out of date, run "${command} ${wantsGameSlice ? 'catalog:game' : 'catalog'}":\n${stale.map((path) => `  ${path}\n`).join('')}`)
    process.exit(1)
  }
  process.stdout.write(`characters-catalog: up to date (${Object.keys(files).length} files)\n`)
} else {
  writeFiles(files)
  process.stdout.write(`characters-catalog: wrote ${Object.keys(files).length} files\n`)
}
