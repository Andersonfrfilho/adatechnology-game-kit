// Inlines three r160, the kit packages (contracts included), the stylesheet and src/main.js into dist/test-room.html (no CDN, no request at all).
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

const names = ['game-contracts', 'game-destruction', 'game-destruction-three', 'game-weapons', 'game-fluids', 'game-fluids-three', 'game-vfx', 'game-vfx-three', 'game-test-room']
for (const p of names) {
  if (!existsSync(join(pkg(p), 'dist/index.js'))) throw new Error(`${p} is not built: run pnpm build at the root first`)
}
const threeDir = join(pkg('game-test-room'), 'node_modules/three')

const result = await esbuild.build({
  entryPoints: [join(here, 'src/main.js')],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  alias: { three: threeDir, ...Object.fromEntries(names.map((p) => [`@adatechnology/${p}`, join(pkg(p), 'dist/index.js')])) },
})
const safe = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1')
const bundle = safe(result.outputFiles[0].text)
const css = safe(readFileSync(join(here, 'src/style.css'), 'utf8'))
const html = readFileSync(join(here, 'index.html'), 'utf8')
  .replace('/*STYLE*/', () => css)
  .replace('/*BUNDLE*/', () => bundle)

mkdirSync(join(here, 'dist'), { recursive: true })
writeFileSync(join(here, 'dist/test-room.html'), html)
console.log(`dist/test-room.html ${(html.length / 1024).toFixed(0)} KB`)
