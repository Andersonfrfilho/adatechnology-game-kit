// Example host: the test room with the generic demo catalogue.
//   ?lang=en            English (default pt-BR)
//   ?scenario=all       run every scenario on load; the report lands in window.__testRoomReport
//   ?scenario=<id>      run one scenario
//   ?items=chair,jerrycan   spawn these catalogue ids in a row on start
//   ?quality=low|medium|high
//   ?ui=0               hide the panels
import * as THREE from 'three'
import { createTestRoom, demoItems } from '@adatechnology/game-test-room'

const params = new URLSearchParams(location.search)
const locale = params.get('lang') === 'en' ? 'en' : 'pt-BR'
document.documentElement.lang = locale
document.title = locale === 'en' ? 'Test room' : 'Sala de testes'

const quality = ['low', 'medium', 'high'].includes(params.get('quality')) ? params.get('quality') : 'medium'
const items = params.get('items')

const room = createTestRoom({
  THREE,
  container: document.getElementById('app'),
  locale,
  catalog: demoItems(locale),
  quality,
  ui: params.get('ui') !== '0',
  initial: items ? items.split(',').filter(Boolean) : undefined,
})

// agents read the behaviour log from here, e.g. __testRoom.log.toNDJSON()
window.__testRoom = room

const wanted = params.get('scenario')
if (wanted) {
  const list = wanted === 'all' ? undefined : room.scenarios.filter((s) => s.id === wanted)
  room.runScenarios(list).then((report) => {
    window.__testRoomReport = report
  })
}
