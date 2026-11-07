// Inlines three r160, the kit packages (contracts included), the stylesheet and src/main.js into dist/test-room.html (no CDN, no request at all).
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, cpSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { kitSfxDir } from '../../packages/game-audio/scripts/sfx-dir.mjs'
import { mergeUserSfxManifests } from '../../packages/game-audio/scripts/sfx-merge.mjs'

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

const names = ['game-audio', 'game-player', 'game-runtime', 'game-contracts', 'game-destruction', 'game-destruction-three', 'game-weapons', 'game-fluids', 'game-fluids-three', 'game-vfx', 'game-vfx-three', 'game-render-three', 'game-terrain', 'game-terrain-three', 'game-characters', 'game-characters-people', 'game-characters-three', 'game-kit-defaults', 'game-floorplan', 'game-floorplan-structure', 'game-floorplan-residential', 'game-floorplan-interactables', 'game-floorplan-three', 'game-props3d', 'game-shapes-three', 'game-weapons-three', 'game-graphics', 'game-graphics-three', 'game-test-room']
for (const p of names) {
  if (!existsSync(join(pkg(p), 'dist/index.js'))) throw new Error(`${p} is not built: run pnpm build at the root first`)
}
const threeDir = join(pkg('game-test-room'), 'node_modules/three')

// Two bundles of the same src/main.js: the BARE room (an empty room; the page the other test areas load their module into, kept in base/)
// and the default page (the same room that loads the teams' content, see the end of this file).
/**
 * @param {boolean} full
 */
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
    // the graphics screen is a subpath of game-graphics (`/screen`), named before its package
    alias: { three: threeDir, '@adatechnology/game-graphics/screen': join(pkg('game-graphics'), 'dist/screen.js'), '@adatechnology/game-audio/fitted': join(pkg('game-audio'), 'dist/fitted.js'), ...Object.fromEntries(names.map((p) => [`@adatechnology/${p}`, join(pkg(p), 'dist/index.js')])) },
  })
  return result.outputFiles[0].text
}
const safe = (/** @type {string} */ s) => s.replace(/<\/(script|style)/gi, '<\\/$1')
// the loading indicator's look comes from the room's own source (game-test-room/src/loading-view.ts, no dependency), so the screen the page starts with and the one the room shows later are one
const view = await esbuild.build({ entryPoints: [join(pkg('game-test-room'), 'src/loading-view.ts')], bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2020' })
const { LOADING_CSS, loadingMarkup } = await import(`data:text/javascript;base64,${Buffer.from(view.outputFiles[0].text).toString('base64')}`)
const css = safe(readFileSync(join(here, 'src/style.css'), 'utf8') + LOADING_CSS)
const template = readFileSync(join(here, 'index.html'), 'utf8')
// The default page paints a loading screen on its first frame; the bare room has nothing to load, so it has none.
const overlay = `${loadingMarkup({ title: 'Carregando a sala de testes…', step: 'Iniciando…', solid: true, fixed: true, id: 'boot' })}
<script>(function(){if(/[?&]lang=en(&|$)/.test(location.search)){var b=document.getElementById('boot');b.querySelector('.tr-loading-label').textContent='Loading the test room…';b.querySelector('.tr-loading-step').textContent='Starting…'}})()</script>`
const page = (/** @type {string} */ bundle, /** @type {boolean} */ full) =>
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
// the kit's recorded sounds: the manifest (id -> path) and the files are in game-audio (assets/sfx); sfx-dir.mjs may point at another folder
// (.sfx-local.json "kit" or KIT_SFX_DIR, a game's set). The manifest keeps only the takes that exist there, so a missing file plays its fitted copy
// and the build does not fail.
const sfxManifestDir = join(pkg('game-audio'), 'assets/sfx')
const sfxDir = kitSfxDir(root)
const sfxManifestFull = existsSync(join(sfxManifestDir, 'manifest.json')) ? JSON.parse(readFileSync(join(sfxManifestDir, 'manifest.json'), 'utf8')) : null
/** @typedef {{ category: string; layers: Record<string, { file: string }[]> }} SfxSound a sound of the kit's sfx manifest: its takes by layer */
/** @typedef {{ sounds: SfxSound[] }} SfxManifest */
/** The manifest with only the takes whose file is on this machine (a sound left with no take is dropped). */
const presentSfx = (/** @type {SfxManifest} */ manifest) => ({
  ...manifest,
  sounds: manifest.sounds
    .map((sound) => ({ ...sound, layers: Object.fromEntries(Object.entries(sound.layers).map(([layer, takes]) => [layer, takes.filter((/** @type {{ file: string; }} */ entry) => existsSync(join(sfxDir, entry.file)))]).filter(([, takes]) => takes.length > 0)) }))
    .filter((/** @type {{ layers: {}; }} */ sound) => Object.keys(sound.layers).length > 0),
})
const sfxManifest = sfxManifestFull ? presentSfx(sfxManifestFull) : null
const sfxTakes = sfxManifest ? sfxManifest.sounds.reduce((count, sound) => count + Object.values(sound.layers).flat().length, 0) : 0
console.log(sfxTakes > 0 ? `sfx: ${sfxTakes} recorded takes from ${sfxDir}` : `sfx: no recorded files at ${sfxDir} (the recipes play; see packages/game-audio/scripts/sfx-dir.mjs)`)
// the ones the modules use (the weapons' shots and reload steps) inlined as data urls: the page still makes no request
const SFX_CATEGORIES = new Set(['armas'])
const sfxSounds = (sfxManifest?.sounds ?? []).filter((/** @type {{ category: string; }} */ sound) => SFX_CATEGORIES.has(sound.category))
const sfxFiles = Object.fromEntries(sfxSounds.flatMap((sound) => Object.values(sound.layers).flat()).map((/** @type {{ file: string; }} */ entry) => [entry.file, `data:audio/ogg;base64,${readFileSync(join(sfxDir, entry.file)).toString('base64')}`]))
const sfxScript = sfxManifest ? `<script>window.__kitSfx=${safe(JSON.stringify({ manifest: { ...sfxManifest, sounds: sfxSounds }, files: sfxFiles }))}</script>\n` : ''
const html = `${fullHtml.slice(0, at)}${sfxScript}<script type="text/plain" id="room-area">${safe(area)}</script>\n<script>${boot}</script>\n${fullHtml.slice(at)}`

mkdirSync(join(here, 'dist'), { recursive: true })
writeFileSync(join(here, 'dist/test-room.html'), html)
console.log(`dist/test-room.html ${(html.length / 1024).toFixed(0)} KB`)

// 4. the kit's recorded sounds next to the page, where the room's engine fetches them (`./sfx/`); they load on first play, so the page itself does
//    not grow. dist/sfx gets the manifest of the files present and a link to each category folder of the sound folder (no copy of 33 MB per
//    build). Opened from file://, or without the files, the fitted copies play.
rmSync(join(here, 'dist/sfx'), { recursive: true, force: true })
if (sfxManifest) {
  mkdirSync(join(here, 'dist/sfx'), { recursive: true })
  writeFileSync(join(here, 'dist/sfx/manifest.json'), `${JSON.stringify(sfxManifest, null, 2)}\n`)
  if (existsSync(join(sfxManifestDir, 'CREDITOS.md'))) cpSync(join(sfxManifestDir, 'CREDITOS.md'), join(here, 'dist/sfx/CREDITOS.md'))
  const categories = new Set(sfxManifest.sounds.flatMap((sound) => Object.values(sound.layers).flat().map((entry) => entry.file.split('/')[0])))
  for (const category of categories) symlinkSync(join(sfxDir, category), join(here, 'dist/sfx', category), 'dir')
  console.log(`dist/sfx: manifest${categories.size > 0 ? ` and links to ${[...categories].join(', ')}` : ' only'}`)
}
// 4b. the owner's own sounds (.sfx-local/, written by `sfx:user` from packs the kit cannot redistribute) next to the page as sfx-local/, only on the
//     machine that has them: the folder is ignored by git, so no CI build or package carries them; it is linked, not copied
//     Or, by reference: `.sfx-local.json` (ignored by git) names a game's own sound folder and its manifest ({ "root": ".../zombiada/src",
//     "manifest": ".../zombiada/src/jogo/sons-sdk.json" }, file paths relative to root). Nothing is copied: dist/sfx-local/ gets the manifest and a
//     link to each folder of root, so the room plays the game's files where they are.
const userSfx = join(root, '.sfx-local')
const userSfxRef = join(root, '.sfx-local.json')
/** The folder of dist/sfx-local/ that `.sfx-local/` is linked to when a game's folder is linked there too. */
const USER_SFX_LINK = '_sfx-user'
rmSync(join(here, 'dist/sfx-local'), { recursive: true, force: true })
const userRef = existsSync(userSfxRef) ? JSON.parse(readFileSync(userSfxRef, 'utf8')) : null
// `.sfx-local.json` may hold only the kit's folder ("kit", "inbox"): the game's own sounds need "root" and "manifest"
if (userRef && typeof userRef.root === 'string' && typeof userRef.manifest === 'string') {
  const ref = userRef
  const dir = join(here, 'dist/sfx-local')
  mkdirSync(dir, { recursive: true })
  cpSync(resolve(root, ref.manifest), join(dir, 'manifest.json'))
  // the game's manifest may sit in its own folder: the copy above stays, never a link over it
  for (const name of readdirSync(resolve(root, ref.root))) if (name !== 'manifest.json') symlinkSync(resolve(root, ref.root, name), join(dir, name))
  console.log(`dist/sfx-local linked to ${ref.root} (the game's own sounds, by reference)`)
  // the sounds `sfx:user` converted (.sfx-local/) the game's manifest does not answer join it, linked under _sfx-user/: a game's folder does not hide them
  if (existsSync(join(userSfx, 'manifest.json'))) {
    const userDir = join(dir, USER_SFX_LINK)
    mkdirSync(userDir)
    for (const name of readdirSync(userSfx)) if (name !== 'manifest.json') symlinkSync(join(userSfx, name), join(userDir, name))
    const merged = mergeUserSfxManifests(JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')), JSON.parse(readFileSync(join(userSfx, 'manifest.json'), 'utf8')), `${USER_SFX_LINK}/`)
    writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(merged.manifest, null, 2)}\n`)
    console.log(`dist/sfx-local: ${merged.added.length} sounds of .sfx-local the game does not have, linked under ${USER_SFX_LINK}/`)
  }
} else if (existsSync(join(userSfx, 'manifest.json'))) {
  // the manifest is copied and each folder linked, never the audio copied: the guard of step 6 refuses audio in dist that is not the SDK's own
  const dir = join(here, 'dist/sfx-local')
  mkdirSync(dir, { recursive: true })
  cpSync(join(userSfx, 'manifest.json'), join(dir, 'manifest.json'))
  for (const name of readdirSync(userSfx)) if (name !== 'manifest.json') symlinkSync(join(userSfx, name), join(dir, name))
  console.log('dist/sfx-local linked to .sfx-local (your sounds, local only)')
}

// 5. the weapon thumbnails (game-weapons-three assets/weapon-svg) next to the page: the areas of the room ask for them at `../weapon-svg/` (the site's
//    layout), which from a server of dist/ is dist/weapon-svg; without them every weapon of the counter is a 404 in the console.
const weaponSvg = join(pkg('game-weapons-three'), 'assets/weapon-svg')
if (existsSync(join(weaponSvg, 'manifest.json'))) {
  rmSync(join(here, 'dist/weapon-svg'), { recursive: true, force: true })
  cpSync(weaponSvg, join(here, 'dist/weapon-svg'), { recursive: true })
  console.log('dist/weapon-svg copied')
}

// 6. a local sound pack of this machine (audio.local.json at the repo root, git-ignored): linked, never copied, into dist/local-audio. Then the
//    guard fails the build if dist holds any audio that is not one of the SDK's own files, so no deploy can carry a local file.
const localAudio = join(root, 'tools/local-audio/local-audio.mjs')
if (process.env.LOCAL_AUDIO !== '0' && existsSync(process.env.LOCAL_AUDIO_CONFIG ?? join(root, 'audio.local.json'))) execFileSync(process.execPath, [localAudio, 'link', join(here, 'dist')], { stdio: 'inherit' })
execFileSync(process.execPath, [localAudio, 'guard', join(here, 'dist')], { stdio: 'inherit' })
