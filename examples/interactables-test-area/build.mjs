// Bundles the furniture area (and the kit packages it needs, the weapons and items modules among them) into dist/furniture-area.js (IIFE, global `FurnitureArea`) and, when the
// shared test room page is found (ROOM_HTML, default the kit's own examples/test-room build), writes dist/sala-moveis.html: the room page
// with the area loaded into it, one file, no network.
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

const people = ['game-characters', 'game-characters-three', 'game-characters-people', 'game-characters-undead', 'game-animals', 'game-animals-species', 'game-animals-three']
// the houses: the plans of every package, their structure and the drawing in three.js
const houses = ['game-destruction', 'game-floorplan', 'game-floorplan-commercial', 'game-floorplan-interactables', 'game-floorplan-post-apocalyptic', 'game-floorplan-residential', 'game-floorplan-rural', 'game-floorplan-structure', 'game-floorplan-three']
const vehicles = ['game-vehicles', 'game-vehicles-fleet', 'game-vehicles-three', 'game-vehicles-driving']
const vegetation = ['game-vegetation', 'game-vegetation-species', 'game-vegetation-three']
const urban = ['game-urban', 'game-urban-three']
  // the crowd: the horde, its drawing on the baked variants and the region model it comes from
  const crowd = ['game-crowd', 'game-crowd-three', 'game-infection']
  // the stories: casting, beats, the life simulation and the character sheet (no 3D)
  const stories = ['game-stories']
for (const p of ['game-interactables', 'game-interactables-household', 'game-interactables-three', 'game-props3d', 'game-vfx', 'game-vfx-three', 'game-terrain', 'game-terrain-three', 'game-weapons', 'game-weapons-three', 'game-contracts', 'game-items', 'game-items-goods', 'game-items-three', 'game-audio', 'game-weather', 'game-weather-three', ...people, ...houses, ...vehicles, ...vegetation, ...urban, 'game-player', ...crowd, ...stories]) {
  if (!existsSync(join(pkg(p), 'dist/index.js'))) throw new Error(`${p} is not built: run pnpm -r build first`)
}

const result = await esbuild.build({
  entryPoints: [join(here, 'src/entry.js')],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'FurnitureArea',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  alias: {
    '@adatechnology/game-floorplan-three/testing': join(pkg('game-floorplan-three'), 'dist/testing.js'),
    '@adatechnology/game-crowd-three/testing': join(pkg('game-crowd-three'), 'dist/testing.js'),
    '@adatechnology/game-animals-three/testing': join(pkg('game-animals-three'), 'dist/testing.js'),
    '@adatechnology/game-characters-three/testing': join(pkg('game-characters-three'), 'dist/testing.js'),
    '@adatechnology/game-interactables': join(pkg('game-interactables'), 'dist/index.js'),
    '@adatechnology/game-interactables-household': join(pkg('game-interactables-household'), 'dist/index.js'),
    '@adatechnology/game-interactables-three': join(pkg('game-interactables-three'), 'dist/index.js'),
    '@adatechnology/game-props3d': join(pkg('game-props3d'), 'dist/index.js'),
    // the effects bench rides along: the smoke, sparks and blood of what the furniture goes through
    '@adatechnology/game-vfx': join(pkg('game-vfx'), 'dist/index.js'),
    '@adatechnology/game-vfx-three': join(pkg('game-vfx-three'), 'dist/index.js'),
    '@adatechnology/game-terrain': join(pkg('game-terrain'), 'dist/index.js'),
    '@adatechnology/game-terrain-three': join(pkg('game-terrain-three'), 'dist/index.js'),
    // the weapons module (with its accessories) rides along: furniture is shot, burned and blown up by real weapons
    '@adatechnology/game-weapons': join(pkg('game-weapons'), 'dist/index.js'),
    '@adatechnology/game-weapons-three': join(pkg('game-weapons-three'), 'dist/index.js'),
    // the items module and the goods catalog ride along: the containers of the furniture hold real items
    '@adatechnology/game-contracts': join(pkg('game-contracts'), 'dist/index.js'),
    // the sound and weather modules ride along: both use what the room lends (host.audio, host.environment)
    '@adatechnology/game-audio': join(pkg('game-audio'), 'dist/index.js'),
    '@adatechnology/game-audio/testing': join(pkg('game-audio'), 'dist/testing.js'),
    '@adatechnology/game-weather': join(pkg('game-weather'), 'dist/index.js'),
    // the player area rides along: the room's camera is the player body
    '@adatechnology/game-player': join(pkg('game-player'), 'dist/index.js'),
    '@adatechnology/game-weather-three': join(pkg('game-weather-three'), 'dist/index.js'),
    '@adatechnology/game-items': join(pkg('game-items'), 'dist/index.js'),
    '@adatechnology/game-items-goods': join(pkg('game-items-goods'), 'dist/index.js'),
    '@adatechnology/game-items-three': join(pkg('game-items-three'), 'dist/index.js'),
    // the characters and the animals modules ride along too: a shot crosses a wardrobe door and reaches a zombie behind it
    ...Object.fromEntries(people.map((p) => [`@adatechnology/${p}`, join(pkg(p), 'dist/index.js')])),
    // the vehicles module rides along too: a car stands in the yard next to the furniture
    ...Object.fromEntries(vehicles.map((p) => [`@adatechnology/${p}`, join(pkg(p), 'dist/index.js')])),
    // the vegetation module rides along too: the plants of the Viveiro can be cut, shot and burnt next to the house
    ...Object.fromEntries(vegetation.map((p) => [`@adatechnology/${p}`, join(pkg(p), 'dist/index.js')])),
    // the urban module rides along too: the street poles, the neighbourhoods and the terrain patch in the same room
    ...Object.fromEntries(urban.map((p) => [`@adatechnology/${p}`, join(pkg(p), 'dist/index.js')])),
    '@adatechnology/game-vegetation/three': join(pkg('game-vegetation'), 'dist/three.js'),
    // the houses area rides along too: the plans of every package, their structure and the drawing, built in the same room as the furniture
    ...Object.fromEntries(houses.map((p) => [`@adatechnology/${p}`, join(pkg(p), 'dist/index.js')])),
    // the crowd area rides along too: a horde on the instanced path that hunts the player body
    ...Object.fromEntries(crowd.map((p) => [`@adatechnology/${p}`, join(pkg(p), 'dist/index.js')])),
    // the stories area rides along too: a world of stories and one character sheet on the room's panel
    ...Object.fromEntries(stories.map((p) => [`@adatechnology/${p}`, join(pkg(p), 'dist/index.js')])),
  },
})
mkdirSync(join(here, 'dist'), { recursive: true })
const bundle = result.outputFiles[0].text
writeFileSync(join(here, 'dist/furniture-area.js'), bundle)
console.log(`dist/furniture-area.js ${(bundle.length / 1024).toFixed(0)} KB`)

const roomHtml = process.env.ROOM_HTML || join(here, '../test-room/base/test-room.html')
if (existsSync(roomHtml)) {
  const safe = (s) => s.replace(/<\/(script)/gi, '<\\/$1')
  const page = readFileSync(roomHtml, 'utf8')
  const at = page.lastIndexOf('</body>')
  if (at < 0) throw new Error('the room page has no </body>')
  // the room page sets window.__testRoom synchronously; our script runs right after it and loads the module into that room
  const boot = `window.__furnitureReport = FurnitureArea.loadInto(window.__testRoom)`
  const html = `${page.slice(0, at)}<script>${safe(bundle)}\n${boot}</script>\n${page.slice(at)}`
  writeFileSync(join(here, 'dist/sala-moveis.html'), html)
  console.log(`dist/sala-moveis.html ${(html.length / 1024).toFixed(0)} KB`)
} else {
  console.log(`room page not found at ${roomHtml}: build examples/test-room first or set ROOM_HTML to build dist/sala-moveis.html`)
}
