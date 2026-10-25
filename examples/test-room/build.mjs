// Inlines three r160, the kit packages (contracts included), the stylesheet and src/main.js into dist/test-room.html (no CDN, no request at all).
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
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

const names = ['game-audio', 'game-contracts', 'game-destruction', 'game-destruction-three', 'game-weapons', 'game-fluids', 'game-fluids-three', 'game-vfx', 'game-vfx-three', 'game-test-room']
for (const p of names) {
  if (!existsSync(join(pkg(p), 'dist/index.js'))) throw new Error(`${p} is not built: run pnpm build at the root first`)
}
const threeDir = join(pkg('game-test-room'), 'node_modules/three')

// Two bundles of the same src/main.js: the BARE room (an empty room; the page the other test areas load their module into, kept in base/)
// and the default page (the same room that loads the teams' content, see the end of this file).
async function bundleMain(full) {
  const result = await esbuild.build({
    entryPoints: [join(here, 'src/main.js')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    legalComments: 'none',
    define: { __ROOM_FULL__: String(full) },
    alias: { three: threeDir, ...Object.fromEntries(names.map((p) => [`@adatechnology/${p}`, join(pkg(p), 'dist/index.js')])) },
  })
  return result.outputFiles[0].text
}
const safe = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1')
const css = safe(readFileSync(join(here, 'src/style.css'), 'utf8'))
const template = readFileSync(join(here, 'index.html'), 'utf8')
const page = (bundle) => template.replace('/*STYLE*/', () => css).replace('/*BUNDLE*/', () => safe(bundle))

// 1. the bare room, for the other areas (they add their own module over it)
const baseHtml = page(await bundleMain(false))
mkdirSync(join(here, 'base'), { recursive: true })
const basePath = join(here, 'base/test-room.html')
writeFileSync(basePath, baseHtml)

// 2. the teams' content: interactables-test-area's entry loads every module (weapons, items, household furniture, characters, animals, vfx, audio, weather,
//    houses, vehicles, vegetation, urban, player, crowd, stories). It builds over the bare room, so there is no cycle; here we only inline its bundle.
execFileSync(process.execPath, [join(here, '../interactables-test-area/build.mjs')], { stdio: 'inherit', env: { ...process.env, ROOM_HTML: basePath } })
const area = readFileSync(join(here, '../interactables-test-area/dist/furniture-area.js'), 'utf8')

// 3. the default page: the room, then the teams' content loaded into it
const fullHtml = page(await bundleMain(true))
const at = fullHtml.lastIndexOf('</body>')
const boot = `window.__furnitureReport = FurnitureArea.loadInto(window.__testRoom)\nwindow.__roomStart && window.__roomStart()`
const html = `${fullHtml.slice(0, at)}<script>${safe(area)}\n${boot}</script>\n${fullHtml.slice(at)}`

mkdirSync(join(here, 'dist'), { recursive: true })
writeFileSync(join(here, 'dist/test-room.html'), html)
console.log(`dist/test-room.html ${(html.length / 1024).toFixed(0)} KB`)
