import { buildCatalog, staleFiles, writeCatalog } from './build'

const isCheck = process.argv.includes('--check')
const files = buildCatalog()

if (isCheck) {
  const stale = staleFiles(files)
  if (stale.length > 0) {
    process.stderr.write(`weapons-catalog: out of date, run "pnpm --filter @adatechnology/weapons-catalog-tool catalog":\n${stale.map((path) => `  ${path}\n`).join('')}`)
    process.exit(1)
  }
  process.stdout.write('weapons-catalog: up to date\n')
} else {
  writeCatalog(files)
  process.stdout.write(`weapons-catalog: wrote ${Object.keys(files).length} files\n`)
}
