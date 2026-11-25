// Inlines three r160, the kit packages, the three data files and src/test/entry.ts into dist/district.html (no CDN, no request at all), and puts what the page
// loads by URL next to it: the kit's recorded sounds (./sfx/) and Jolt's multithreaded module (?joltBuild=multithread; the default single build rides inside the page).
import { createRequire } from 'node:module'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { kitSfxDir } from '../../packages/game-audio/scripts/sfx-dir.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const pkg = (/** @type {string} */ name) => join(root, 'packages', name)

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

const manifest = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'))
for (const name of Object.keys(manifest.devDependencies).filter((n) => n.startsWith('@adatechnology/'))) {
  const folder = name.replace('@adatechnology/', '')
  if (!existsSync(join(pkg(folder), 'dist/index.js'))) throw new Error(`${folder} is not built: run pnpm build at the root first`)
}
// the kit's worker (every kind of the kit) as a classic script: the page's coordinator starts its workers from a Blob, so the page makes no request
const kitWorkerSource = readFileSync(join(pkg('game-kit-defaults'), 'dist/kit-worker.global.js'), 'utf8')

const result = await esbuild.build({
  entryPoints: [join(here, 'src/test/entry.ts')],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: process.env.DISTRICT_MINIFY !== '0',
  legalComments: 'none',
  define: { 'globalThis.__KIT_WORKER_SOURCE__': JSON.stringify(kitWorkerSource) },
  // Jolt's Node build names `node:module`, which the browser build never reaches
  external: ['node:module'],
  alias: { three: join(here, 'node_modules/three') },
})
const safe = (/** @type {string} */ text) => text.replace(/<\/(script|style)/gi, '<\\/$1')
// the first screen is the kit's loading card as static markup (its look from game-kit-defaults/src/world/loading-view.ts, no dependency), painted before the bundle runs: the bundle rides as
// inert text and a boot script runs it after a paint; the district's live card (startDistrict) then takes over and the markup goes (src/test/entry.ts)
const view = await esbuild.build({ entryPoints: [join(pkg('game-kit-defaults'), 'src/world/loading-view.ts')], bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2020' })
const { LOADING_CSS, loadingMarkup } = await import(`data:text/javascript;base64,${Buffer.from(view.outputFiles[0].text).toString('base64')}`)
const bootScreen = loadingMarkup({ title: 'Carregando o bairro…', step: 'Iniciando…', solid: true, fixed: true, id: 'boot' })
const boot = `(function () {
  var run = function () {
    var script = document.createElement('script')
    script.textContent = document.getElementById('district-bundle').textContent
    document.body.appendChild(script)
  }
  var done = false
  var once = function () { if (!done) { done = true; run() } }
  requestAnimationFrame(function () { setTimeout(once, 0) })
  setTimeout(once, 100)
})()`
const css = `html,body{margin:0;height:100%;background:#000;overflow:hidden}#app{position:fixed;inset:0}#app canvas{display:block}${LOADING_CSS}`
const page = readFileSync(join(here, 'index.html'), 'utf8')
  .replace('/*STYLE*/', () => css)
  .replace('<script>/*BUNDLE*/</script>', () => `${bootScreen}\n<script type="text/plain" id="district-bundle">${safe(result.outputFiles[0].text)}</script>\n<script>${boot}</script>`)
const dist = join(here, 'dist')
mkdirSync(dist, { recursive: true })
writeFileSync(join(dist, 'district.html'), page)
console.log(`dist/district.html ${(page.length / 1024).toFixed(0)} KB`)

copyFileSync(createRequire(join(pkg('game-physics-jolt'), 'package.json')).resolve('jolt-physics/wasm-compat-multithread'), join(dist, 'jolt-physics.multithread.wasm-compat.js'))

// the kit's recorded sounds where the world's engine fetches them (`./sfx/`): the manifest of the takes present and a link to each category folder (no copy)
rmSync(join(dist, 'sfx'), { recursive: true, force: true })
const sfxDir = kitSfxDir(root)
const manifestPath = join(pkg('game-audio'), 'assets/sfx/manifest.json')
if (existsSync(manifestPath)) {
  const sfx = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const present = sfx.sounds
    .map((/** @type {{ layers: Record<string, { file: string }[]> }} */ sound) => ({ ...sound, layers: Object.fromEntries(Object.entries(sound.layers).map(([layer, takes]) => [layer, takes.filter((take) => existsSync(join(sfxDir, take.file)))]).filter(([, takes]) => takes.length > 0)) }))
    .filter((/** @type {{ layers: object }} */ sound) => Object.keys(sound.layers).length > 0)
  mkdirSync(join(dist, 'sfx'), { recursive: true })
  writeFileSync(join(dist, 'sfx/manifest.json'), `${JSON.stringify({ ...sfx, sounds: present }, null, 2)}\n`)
  const categories = new Set(present.flatMap((/** @type {{ layers: Record<string, { file: string }[]> }} */ sound) => Object.values(sound.layers).flat().map((take) => take.file.split('/')[0])))
  for (const category of categories) symlinkSync(join(sfxDir, category), join(dist, 'sfx', category), 'dir')
  console.log(`dist/sfx: manifest and links to ${categories.size} categories`)
}
