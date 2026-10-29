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

const room = createTestRoom({
  THREE,
  container: document.getElementById('app'),
  locale,
  catalog: [],
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
// the default page publishes the room when its content is loaded (the boot script in build.mjs), so a test that waits for `__testRoom` never sees a half-loaded one
if (deferred) window.__bootRoom = room
else window.__testRoom = room
window.__THREE = THREE

async function start() {
  if (deferred) {
    if (items) for (const [i, id] of items.split(',').filter(Boolean).entries()) room.spawn(id, [(i - (items.split(',').filter(Boolean).length - 1) / 2) * 1.3, 0, 0.5])
    // an area with hundreds of items takes a second: the room's loading indicator says which one is opening
    if (params.get('area')) await room.openAreaAsync(params.get('area'))
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
