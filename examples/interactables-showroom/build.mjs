// Inlines three r160, the three kit packages, the stylesheet and src/showroom.js into dist/showroom.html (no CDN, no request at all).
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const pkg = (name) => join(root, 'packages', name)

function findEsbuild() {
  const store = join(root, 'node_modules/.pnpm')
  const dirs = readdirSync(store).filter((d) => d.startsWith('esbuild@')).sort().reverse()
  for (const d of dirs) {
    const p = join(store, d, 'node_modules/esbuild')
    if (existsSync(join(p, 'lib/main.js'))) return p
  }
  throw new Error('esbuild not found in node_modules/.pnpm (run pnpm install)')
}
const esbuild = createRequire(import.meta.url)(findEsbuild())

const threeDir = join(pkg('game-interactables-three'), 'node_modules/three')
for (const p of ['game-interactables', 'game-interactables-household', 'game-interactables-three', 'game-terrain', 'game-terrain-three']) {
  if (!existsSync(join(pkg(p), 'dist/index.js'))) throw new Error(`${p} is not built: run pnpm -r build first`)
}

const result = await esbuild.build({
  entryPoints: [join(here, 'src/entry.js')],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  alias: {
    three: threeDir,
    '@adatechnology/game-interactables': join(pkg('game-interactables'), 'dist/index.js'),
    '@adatechnology/game-interactables-household': join(pkg('game-interactables-household'), 'dist/index.js'),
    '@adatechnology/game-interactables-three': join(pkg('game-interactables-three'), 'dist/index.js'),
    '@adatechnology/game-terrain': join(pkg('game-terrain'), 'dist/index.js'),
    '@adatechnology/game-terrain-three': join(pkg('game-terrain-three'), 'dist/index.js'),
    '@adatechnology/game-contracts': join(pkg('game-contracts'), 'dist/index.js'),
    '@adatechnology/game-destruction': join(pkg('game-destruction'), 'dist/index.js'),
  },
})
const safe = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1')
const bundle = safe(result.outputFiles[0].text)
const app = safe(readFileSync(join(here, 'src/showroom.js'), 'utf8'))
const css = safe(readFileSync(join(here, 'src/style.css'), 'utf8'))
const html = readFileSync(join(here, 'index.html'), 'utf8')
  .replace('/*STYLE*/', () => css)
  .replace('/*BUNDLE*/', () => bundle)
  .replace('/*APP*/', () => app)

mkdirSync(join(here, 'dist'), { recursive: true })
writeFileSync(join(here, 'dist/showroom.html'), html)
console.log(`dist/showroom.html ${(html.length / 1024).toFixed(0)} KB`)
