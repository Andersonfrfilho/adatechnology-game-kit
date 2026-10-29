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

const names = ['game-audio', 'game-contracts', 'game-destruction', 'game-destruction-three', 'game-weapons', 'game-fluids', 'game-fluids-three', 'game-vfx', 'game-vfx-three', 'game-characters', 'game-characters-three', 'game-test-room']
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
// The default page paints a loading screen on its first frame; the bare room has nothing to load, so it has none.
const overlay = `<div id="boot" role="status" aria-live="polite"><div class="boot-card"><div class="boot-title" id="boot-title">Carregando a sala de testes…</div><div class="boot-bar"><i id="boot-fill"></i></div><div class="boot-step" id="boot-step">Iniciando…</div></div></div>
<script>(function(){if(/[?&]lang=en(&|$)/.test(location.search)){document.getElementById('boot-title').textContent='Loading the test room…';document.getElementById('boot-step').textContent='Starting…'}})()</script>`
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
  var fill = document.getElementById('boot-fill')
  var stepText = document.getElementById('boot-step')
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
  var progress = function (p) {
    if (p.done) {
      fill.style.width = '100%'
      return
    }
    fill.style.width = (((p.index - 1) / p.total) * 100).toFixed(1) + '%'
    stepText.textContent = p.name + ' ' + p.index + '/' + p.total
  }
  var failed = function (error) {
    stepText.textContent = (lang === 'en' ? 'Loading failed: ' : 'Falha ao carregar: ') + (error && error.message ? error.message : error)
    stepText.style.color = '#ff8a80'
    throw error
  }
  paint().then(paint).then(function () {
    run('room-bundle')
    return paint()
  }).then(function () {
    run('room-area')
    return FurnitureArea.loadIntoAsync(window.__bootRoom, { onProgress: progress })
  }).then(function (report) {
    window.__bootReport = report
    window.__roomStart && window.__roomStart()
    stepText.textContent = lang === 'en' ? 'Preparing the picture…' : 'Preparando a imagem…'
    fill.style.width = '100%'
    return paint()
  }).then(function () {
    window.__bootRoom.warmUp()
    return paint()
  }).then(function () {
    window.__testRoom = window.__bootRoom
    window.__furnitureReport = window.__bootReport
    var overlay = document.getElementById('boot')
    overlay.classList.add('boot-done')
    setTimeout(function () { overlay.remove() }, 400)
  }).catch(failed)
})()`
const html = `${fullHtml.slice(0, at)}<script type="text/plain" id="room-area">${safe(area)}</script>\n<script>${boot}</script>\n${fullHtml.slice(at)}`

mkdirSync(join(here, 'dist'), { recursive: true })
writeFileSync(join(here, 'dist/test-room.html'), html)
console.log(`dist/test-room.html ${(html.length / 1024).toFixed(0)} KB`)
