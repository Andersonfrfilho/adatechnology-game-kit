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

const names = ['game-audio', 'game-player', 'game-runtime', 'game-contracts', 'game-destruction', 'game-destruction-three', 'game-weapons', 'game-fluids', 'game-fluids-three', 'game-vfx', 'game-vfx-three', 'game-render-three', 'game-terrain', 'game-terrain-three', 'game-characters', 'game-characters-people', 'game-characters-three', 'game-kit-defaults', 'game-floorplan', 'game-floorplan-structure', 'game-floorplan-residential', 'game-floorplan-interactables', 'game-floorplan-three', 'game-props3d', 'game-shapes-three', 'game-weapons-three', 'game-test-room']
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
    minify: process.env.ROOM_MINIFY !== '0',
    legalComments: 'none',
    define: { __ROOM_FULL__: String(full) },
    alias: { three: threeDir, ...Object.fromEntries(names.map((p) => [`@adatechnology/${p}`, join(pkg(p), 'dist/index.js')])) },
  })
  return result.outputFiles[0].text
}
const safe = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1')
// the loading indicator's look comes from the room's own source (game-test-room/src/loading-view.ts, no dependency), so the screen the page starts with and the one the room shows later are one
const view = await esbuild.build({ entryPoints: [join(pkg('game-test-room'), 'src/loading-view.ts')], bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2020' })
const { LOADING_CSS, loadingMarkup } = await import(`data:text/javascript;base64,${Buffer.from(view.outputFiles[0].text).toString('base64')}`)
const css = safe(readFileSync(join(here, 'src/style.css'), 'utf8') + LOADING_CSS)
const template = readFileSync(join(here, 'index.html'), 'utf8')
// The default page paints a loading screen on its first frame; the bare room has nothing to load, so it has none.
const overlay = `${loadingMarkup({ title: 'Carregando a sala de testes…', step: 'Iniciando…', solid: true, fixed: true, id: 'boot' })}
<script>(function(){if(/[?&]lang=en(&|$)/.test(location.search)){var b=document.getElementById('boot');b.querySelector('.tr-loading-label').textContent='Loading the test room…';b.querySelector('.tr-loading-step').textContent='Starting…'}})()</script>`
const page = (bundle, full) =>
  template
    .replace('/*STYLE*/', () => css)
    .replace('<!--BOOT-->', () => (full ? overlay : ''))
    .replace('<script>/*BUNDLE*/</script>', () => (full ? `<script type="text/plain" id="room-bundle">${safe(bundle)}</script>` : `<script>${safe(bundle)}</script>`))

// 1. the bare room, for the other areas (they add their own module over it)
const baseHtml = page(await bundleMain(false), false)
mkdirSync(join(here, 'base'), { recursive: true })
const basePath = join(here, 'base/test-room.html')
writeFileSync(basePath, baseHtml)

// 2. the teams' content: interactables-test-area's entry loads every module (weapons, items, household furniture, characters, animals, vfx, audio, weather,
//    houses, vehicles, vegetation, urban, player, crowd, stories). It builds over the bare room, so there is no cycle; here we only inline its bundle.
execFileSync(process.execPath, [join(here, '../interactables-test-area/build.mjs')], { stdio: 'inherit', env: { ...process.env, ROOM_HTML: basePath } })
const area = readFileSync(join(here, '../interactables-test-area/dist/furniture-area.js'), 'utf8')

// 3. the default page: the room, then the teams' content loaded into it. Both bundles ride as inert text so the HTML parses at once and the loading screen paints on the first frame;
//    the boot script then runs the room bundle after a paint, loads the modules one at a time (yielding to the browser between them, with the step on the screen) and removes the screen.
const fullHtml = page(await bundleMain(true), true)
const at = fullHtml.lastIndexOf('</body>')
const boot = `(function () {
  var lang = /[?&]lang=en(&|$)/.test(location.search) ? 'en' : 'pt'
  var title = lang === 'en' ? 'Loading the test room…' : 'Carregando a sala de testes…'
  var paint = function () {
    return new Promise(function (resolve) {
      var done = false
      var finish = function () { if (!done) { done = true; resolve() } }
      requestAnimationFrame(function () { setTimeout(finish, 0) })
      setTimeout(finish, 100)
    })
  }
  var run = function (id) {
    var script = document.createElement('script')
    script.textContent = document.getElementById(id).textContent
    document.body.appendChild(script)
  }
  var shown = document.getElementById('boot')
  var task = null
  // the first screen is static markup (the room's bundle has not run); once the room exists its own loading indicator takes over, opaque, and the markup goes
  var progress = function (p) {
    if (p.done) return task.step(undefined, 100)
    task.step(p.name + ' ' + p.index + '/' + p.total, Math.round(((p.index - 1) / p.total) * 100))
  }
  var failed = function (error) {
    var text = (lang === 'en' ? 'Loading failed: ' : 'Falha ao carregar: ') + (error && error.message ? error.message : error)
    var step = (document.querySelector('.tr-loading-step') || {})
    step.textContent = text
    step.style && (step.style.color = '#ff8a80')
    throw error
  }
  paint().then(paint).then(function () {
    run('room-bundle')
    task = window.__bootRoom.loading.begin(title, { total: 100, opaque: true })
    task.step(lang === 'en' ? 'Starting…' : 'Iniciando…', 0)
    return paint()
  }).then(function () {
    // with ?ui=0 the room draws no indicator: the first screen stays until the end
    if (window.__bootRoom.loading.element) shown.remove()
    run('room-area')
    return FurnitureArea.loadIntoAsync(window.__bootRoom, { onProgress: progress })
  }).then(function (report) {
    window.__bootReport = report
    return window.__roomStart && window.__roomStart()
  }).then(function () {
    task.step(lang === 'en' ? 'Preparing the picture…' : 'Preparando a imagem…', 100)
    return paint()
  }).then(function () {
    window.__bootRoom.warmUp()
    return paint()
  }).then(function () {
    window.__testRoom = window.__bootRoom
    window.__furnitureReport = window.__bootReport
    task.end()
    shown.remove()
  }).catch(failed)
})()`
const html = `${fullHtml.slice(0, at)}<script type="text/plain" id="room-area">${safe(area)}</script>\n<script>${boot}</script>\n${fullHtml.slice(at)}`

mkdirSync(join(here, 'dist'), { recursive: true })
writeFileSync(join(here, 'dist/test-room.html'), html)
console.log(`dist/test-room.html ${(html.length / 1024).toFixed(0)} KB`)
