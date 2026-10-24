// Example host: the test room with the generic demo catalogue.
//   ?lang=en            English (default pt-BR)
//   ?scenario=all       run every scenario on load; the report lands in window.__testRoomReport
//   ?scenario=<id>      run one scenario
//   ?items=chair,jerrycan   spawn these catalogue ids in a row on start
//   ?area=furniture     open on one catalogue group (furniture, structure, vehicles, plants, items, containers, weapons)
//   ?quality=low|medium|high
//   ?ui=0               hide the panels
//   ?arena=40           half size of the arena in metres (default 14): the houses area needs room for a whole lot
//   ?bench.<moduleId>=size=2;smoke=0   bench state of that module (the page keeps it up to date as the controls change)
import * as THREE from 'three'
import { createTestRoom, demoItems } from '@adatechnology/game-test-room'
import { DEMO_MODULE } from './demo-module.js'

const params = new URLSearchParams(location.search)
const BENCH_PARAM_PREFIX = 'bench.'
const locale = params.get('lang') === 'en' ? 'en' : 'pt-BR'
document.documentElement.lang = locale
document.title = locale === 'en' ? 'Test room' : 'Sala de testes'

const arena = Number(params.get('arena'))
const quality = ['low', 'medium', 'high'].includes(params.get('quality')) ? params.get('quality') : 'medium'
const items = params.get('items')

const en = locale === 'en'
// A scenario that loads a module of another package through the contracts (`room.loadModule`) and checks it end to end: the contract
// checks pass, the car opens its own door (an `AnimationClipSpec`) and the module's own scenarios run.
const loadModuleScenario = {
  id: 'load_rental_car_module',
  name: en ? 'Module: load the rental car and pass the contract checks' : 'Módulo: carregar o carro de aluguel e passar nas verificações do contrato',
  async run(ctx) {
    const { room, step, expect } = ctx
    const rep = room.loadModule(DEMO_MODULE)
    expect(rep.ok && rep.items.includes('rental_car'), en ? `Module "${rep.module}" loaded: ${rep.items.length} item(s), ${rep.scenarios.length} scenario(s), contract problems: ${rep.problems.length} (expected: 0)` : `Módulo "${rep.module}" carregado: ${rep.items.length} item(ns), ${rep.scenarios.length} cenário(s), problemas de contrato: ${rep.problems.length} (esperado: 0)`, { problems: rep.problems })
    const checks = room.log.entries({ channel: 'check' }).filter((e) => e.data?.module === rep.module)
    expect(checks.length >= 2 && checks.every((e) => e.type === 'pass'), en ? `Contract check lines in the log: ${checks.length}, all ✓` : `Linhas de verificação do contrato no log: ${checks.length}, todas ✓`, { checks: checks.length })
    const so = room.spawn('rental_car', [0, 0, -5], 0)
    const door = so.root.getObjectByName('door_l')
    room.look([-3, 1.2, -1.5], [-0.8, 0.75, -4.3])
    const info = room.animations()
    expect(info?.itemId === 'rental_car' && info.clips.some((c) => c.id === 'open'), en ? `Animations panel for the aimed car: ${info?.clips.map((c) => c.id).join(', ') ?? 'none'} (expected: open)` : `Painel de animações do carro mirado: ${info?.clips.map((c) => c.id).join(', ') ?? 'nenhuma'} (esperado: open)`)
    const played = room.playAnimation('open')
    step(1.5)
    expect(played && door.rotation.y > 1.0, en ? `Door "open" clip: played ${played}, door turned ${door.rotation.y.toFixed(2)} rad (expected: more than 1.0)` : `Clipe "open" da porta: tocou ${played ? 'sim' : 'não'}, porta girou ${door.rotation.y.toFixed(2)} rad (esperado: mais que 1,0)`)
    const ev = room.log.entries({ type: 'animation_event' }).length
    expect(ev === 2, en ? `Clip events in the log: ${ev} (expected: 2 sounds)` : `Eventos do clipe no log: ${ev} (esperado: 2 sons)`)
    for (const sc of room.scenarios.filter((s) => rep.scenarios.includes(s.id))) {
      room.clear()
      await sc.run(ctx)
    }
  },
}

const room = createTestRoom({
  THREE,
  container: document.getElementById('app'),
  locale,
  catalog: demoItems(locale),
  scenarios: [loadModuleScenario],
  quality,
  arenaSize: arena >= 14 && arena <= 200 ? arena : undefined,
  ui: params.get('ui') !== '0',
  initial: items ? items.split(',').filter(Boolean) : undefined,
  area: params.get('area') ?? undefined,
  bench: {
    state: Object.fromEntries([...params].filter(([key]) => key.startsWith(BENCH_PARAM_PREFIX)).map(([key, value]) => [key.slice(BENCH_PARAM_PREFIX.length), value])),
    onChange: (moduleId, encoded) => {
      const url = new URL(location.href)
      url.searchParams.set(BENCH_PARAM_PREFIX + moduleId, encoded)
      history.replaceState(null, '', url)
    },
  },
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
