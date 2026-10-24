// Bundles the crowd area (@adatechnology/game-crowd-three with the undead pack, the animals and a region model) into dist/crowd-area.js (IIFE, global `CrowdArea`) and,
// when the shared test room page is found (ROOM_HTML, default the kit's own examples/test-room build), writes dist/sala-multidao.html: the room
// page with the area loaded and opened, one file, no network.
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

const packages = ['game-crowd', 'game-crowd-three', 'game-characters', 'game-characters-three', 'game-characters-undead', 'game-player', 'game-audio', 'game-animals', 'game-animals-species', 'game-animals-three', 'game-props3d', 'game-infection']
for (const p of [...packages, 'game-contracts']) {
  if (!existsSync(join(pkg(p), 'dist/index.js'))) throw new Error(`${p} is not built: run pnpm -r build first`)
}

const result = await esbuild.build({
  entryPoints: [join(here, 'src/entry.js')],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'CrowdArea',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  alias: Object.fromEntries([...packages, 'game-contracts'].map((p) => [`@adatechnology/${p}`, join(pkg(p), 'dist/index.js')])),
})
mkdirSync(join(here, 'dist'), { recursive: true })
const bundle = result.outputFiles[0].text
writeFileSync(join(here, 'dist/crowd-area.js'), bundle)
console.log(`dist/crowd-area.js ${(bundle.length / 1024).toFixed(0)} KB`)

const roomHtml = process.env.ROOM_HTML || join(here, '../test-room/dist/test-room.html')
if (existsSync(roomHtml)) {
  const safe = (s) => s.replace(/<\/(script)/gi, '<\\/$1')
  const page = readFileSync(roomHtml, 'utf8')
  const at = page.lastIndexOf('</body>')
  if (at < 0) throw new Error('the room page has no </body>')
  // the room page sets window.__testRoom synchronously; our script runs right after it, loads the module into that room and opens its area
  const boot = `window.__crowdReport = CrowdArea.loadInto(window.__testRoom)`
  const html = `${page.slice(0, at)}<script>${safe(bundle)}\n${boot}</script>\n${page.slice(at)}`
  writeFileSync(join(here, 'dist/sala-multidao.html'), html)
  console.log(`dist/sala-multidao.html ${(html.length / 1024).toFixed(0)} KB`)
} else {
  console.log(`room page not found at ${roomHtml}: build examples/test-room first or set ROOM_HTML to build dist/sala-multidao.html`)
}
