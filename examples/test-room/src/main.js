// Example host: the test room with the teams' content (the weapons, items, household furniture, characters, animals, effects, sound, weather,
// houses, vehicles, vegetation, urban, player, crowd and stories modules; build.mjs appends the loader after this script).
//   ?lang=en            English (default pt-BR)
//   ?scenario=all       run every scenario on load; the report lands in window.__testRoomReport
//   ?scenario=<id>      run one scenario
//   ?items=a,b          spawn these catalogue ids (e.g. fridge,wardrobe) in a row on start
//   ?area=furniture     open on one catalogue group (the groups the loaded modules add)
//   ?quality=low|medium|high
//   ?ui=0               hide the panels
//   ?cam=third          start in third person (V toggles 1st/3rd person at any time; the player's body is in the room)
//   ?arena=40           half size of the arena in metres (default 14): the houses area needs room for a whole lot
//   ?bench.<moduleId>=size=2;smoke=0   bench state of that module (the page keeps it up to date as the controls change)
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import { buildWallSpecimen } from '@adatechnology/game-floorplan-structure'
import { buildSpecimenMeshes, furnitureSpec, tapSpec } from '@adatechnology/game-floorplan-three'
import { createPlayerAvatar, toRoomAvatar } from '@adatechnology/game-characters-three'

// build.mjs defines __ROOM_FULL__: true on the default page (the teams' content is loaded after this script), false on the bare room the other areas build over
/* global __ROOM_FULL__ */
const params = new URLSearchParams(location.search)
// the room itself has no items: the default page loads the SDK modules into it (see build.mjs); the bare room (__ROOM_FULL__ false) is the page the other test areas build over
const deferred = __ROOM_FULL__
const BENCH_PARAM_PREFIX = 'bench.'
const locale = params.get('lang') === 'en' ? 'en' : 'pt-BR'
document.documentElement.lang = locale
document.title = locale === 'en' ? 'Test room' : 'Sala de testes'

const arena = Number(params.get('arena'))
const quality = ['low', 'medium', 'high'].includes(params.get('quality')) ? params.get('quality') : 'medium'
const items = params.get('items')

// The room's scenery is the kit's own pieces: the wall of the structure package (brick, plastered), and the team's table and bookcase.
// `buildWallSpecimen` gives one part for a whole wall (a 10 m wall in `panels` is a single slab) and 1761 bricks in `units`, too many for the room (the page takes minutes to
// load). So the 10 x 3 m wall is 8 x 6 cells of the same specimen, 1.25 x 0.5 m each (48 parts, like the wall it replaces): each cell is the specimen's own wall part
// (plastered brick with its units and breach), the bottom row stands on the ground and the cells are bonded with mortar.
function brickWall(cols, rows, cw, ch) {
  const cell = buildWallSpecimen({ assembly: 'brick_wall_plastered', w: cw, h: ch }).parts.find((p) => p.id === 'wall_specimen')
  const parts = []
  const joints = []
  const id = (c, r) => `brick_${r}_${c}`
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      parts.push({ ...structuredClone(cell), id: id(c, r), position: [(c - (cols - 1) / 2) * cw, ch / 2 + r * ch, 0], ...(r === 0 ? { anchored: true } : {}) })
      if (c > 0) joints.push({ a: id(c - 1, r), b: id(c, r), kind: 'mortar' })
      if (r > 0) joints.push({ a: id(c, r - 1), b: id(c, r), kind: 'mortar' })
    }
  }
  return { name: 'brick wall', parts, joints, tags: ['structure'] }
}
const wallSpec = brickWall(8, 6, 1.25, 0.5)
const table = furnitureSpec(THREE, 'dining_table', { w: 1.6, d: 0.8, h: 0.78, options: { chairs: false } })
const shelf = furnitureSpec(THREE, 'bookcase')
// the water tap is the team's counter tap (the sink's), standing on the table top
const tap = tapSpec(THREE)
const scenery = {
  target_wall: { spec: wallSpec, position: [0, 0, -11], build: (T) => buildSpecimenMeshes(T, wallSpec) },
  table: { spec: table.spec, position: [3.5, 0, 0], build: table.build, top: table.top },
  shelf: { spec: shelf.spec, position: [-3.5, 0, 0], build: shelf.build },
}

const room = createTestRoom({
  THREE,
  container: document.getElementById('app'),
  locale,
  catalog: [],
  scenery,
  tap: { build: tap.build, spout: tap.spout },
  quality,
  arenaSize: arena >= 14 && arena <= 200 ? arena : undefined,
  ui: params.get('ui') !== '0',
  // with the SDK modules, the ids and the area exist only after the loader ran: __roomStart handles them
  initial: !deferred && items ? items.split(',').filter(Boolean) : undefined,
  area: !deferred ? (params.get('area') ?? undefined) : undefined,
  bench: {
    state: Object.fromEntries([...params].filter(([key]) => key.startsWith(BENCH_PARAM_PREFIX)).map(([key, value]) => [key.slice(BENCH_PARAM_PREFIX.length), value])),
    onChange: (moduleId, encoded) => {
      const url = new URL(location.href)
      url.searchParams.set(BENCH_PARAM_PREFIX + moduleId, encoded)
      history.replaceState(null, '', url)
    },
  },
})

// the player's body (the team game's player, @adatechnology/game-characters-three): seen in third person, hidden in first. V toggles.
// The first person stays the default; pages that load an area (`window.__THREE` is for them) may start in third.
room.setAvatar(toRoomAvatar(createPlayerAvatar(THREE)))
if (params.get('cam') === 'third') room.setCameraMode('third')
// V is the camera; say it once, in the room's language
room.log.add({ channel: 'action', type: 'hint', text: locale === 'en' ? 'Press V for 1st/3rd person (your body shows in the 3rd).' : 'Aperte V para 1ª/3ª pessoa (seu corpo aparece na 3ª).' })

// agents read the behaviour log from here, e.g. __testRoom.log.toNDJSON()
window.__testRoom = room
window.__THREE = THREE

function start() {
  if (deferred) {
    if (items) for (const [i, id] of items.split(',').filter(Boolean).entries()) room.spawn(id, [(i - (items.split(',').filter(Boolean).length - 1) / 2) * 1.3, 0, 0.5])
    if (params.get('area')) room.openArea(params.get('area'))
  }
  const wanted = params.get('scenario')
  if (wanted) {
    const list = wanted === 'all' ? undefined : room.scenarios.filter((s) => s.id === wanted)
    room.runScenarios(list).then((report) => {
      window.__testRoomReport = report
    })
  }
}
// the default page runs this after the teams' content is loaded (see build.mjs); the bare room starts right away
if (!deferred) start()
else window.__roomStart = start
