// Builds a self-contained, offline 2D viewer: viewer/viewer.html with the five IIFE builds inlined.
// Usage: pnpm build && pnpm --filter @adatechnology/game-floorplan viewer:build
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const packages = resolve(here, '../..')
const BUNDLES = [
  ['game-floorplan', 'GameFloorplan'],
  ['game-floorplan-residential', 'GameFloorplanResidential'],
  ['game-floorplan-commercial', 'GameFloorplanCommercial'],
  ['game-floorplan-post-apocalyptic', 'GameFloorplanPostApocalyptic'],
  ['game-floorplan-structure', 'GameFloorplanStructure'],
]

const out = process.argv[2] ? resolve(process.argv[2]) : join(here, 'dist', 'floorplan-viewer.html')
const scripts = BUNDLES.map(([dir, global]) => {
  const file = join(packages, dir, 'dist', 'index.global.js')
  if (!existsSync(file)) {
    console.error(`Missing ${file}. Run "pnpm build" first.`)
    process.exit(1)
  }
  const code = readFileSync(file, 'utf8').replace(/\/\/# sourceMappingURL=.*$/gm, '').replace(/<\/script/gi, '<\\/script')
  if (!code.includes(global)) {
    console.error(`${file} does not define ${global}.`)
    process.exit(1)
  }
  return `<script>/* ${dir} */\n${code}\n</script>`
})

const html = readFileSync(join(here, 'viewer.html'), 'utf8').replace('<!--BUNDLES-->', () => scripts.join('\n'))
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, html)
console.log(`Viewer written to ${out} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`)
