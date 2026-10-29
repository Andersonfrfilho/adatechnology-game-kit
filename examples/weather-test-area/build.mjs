// Bundles the weather area (@adatechnology/game-weather, the weather bench module) into dist/weather-area.js (IIFE, global `WeatherArea`) and,
// when the shared test room page is found (ROOM_HTML, default the kit's own examples/test-room build), writes dist/sala-clima.html: the room
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

const vehicles = ['game-vehicles', 'game-vehicles-fleet', 'game-vehicles-three']
for (const p of ['game-weather', 'game-weather-three', 'game-vfx', 'game-contracts', ...vehicles]) {
  if (!existsSync(join(pkg(p), 'dist/index.js'))) throw new Error(`${p} is not built: run pnpm -r build first`)
}

const result = await esbuild.build({
  entryPoints: [join(here, 'src/entry.js')],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'WeatherArea',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  alias: {
    '@adatechnology/game-weather': join(pkg('game-weather'), 'dist/index.js'),
    '@adatechnology/game-weather-three': join(pkg('game-weather-three'), 'dist/index.js'),
    '@adatechnology/game-vfx': join(pkg('game-vfx'), 'dist/index.js'),
    '@adatechnology/game-contracts': join(pkg('game-contracts'), 'dist/index.js'),
    '@adatechnology/game-audio': join(pkg('game-audio'), 'dist/index.js'),
    // the lamp rig's car comes from the vehicles SDK
    ...Object.fromEntries(vehicles.map((p) => [`@adatechnology/${p}`, join(pkg(p), 'dist/index.js')])),
  },
})
mkdirSync(join(here, 'dist'), { recursive: true })
const bundle = result.outputFiles[0].text
writeFileSync(join(here, 'dist/weather-area.js'), bundle)
console.log(`dist/weather-area.js ${(bundle.length / 1024).toFixed(0)} KB`)

const roomHtml = process.env.ROOM_HTML || join(here, '../test-room/base/test-room.html')
if (existsSync(roomHtml)) {
  const safe = (s) => s.replace(/<\/(script)/gi, '<\\/$1')
  const page = readFileSync(roomHtml, 'utf8')
  const at = page.lastIndexOf('</body>')
  if (at < 0) throw new Error('the room page has no </body>')
  // the room page sets window.__testRoom synchronously; our script runs right after it, loads the module into that room and opens its area
  const boot = `window.__weatherReport = WeatherArea.loadInto(window.__testRoom)`
  const html = `${page.slice(0, at)}<script>${safe(bundle)}\n${boot}</script>\n${page.slice(at)}`
  writeFileSync(join(here, 'dist/sala-clima.html'), html)
  console.log(`dist/sala-clima.html ${(html.length / 1024).toFixed(0)} KB`)
} else {
  console.log(`room page not found at ${roomHtml}: build examples/test-room first or set ROOM_HTML to build dist/sala-clima.html`)
}
