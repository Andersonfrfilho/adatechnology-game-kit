/* global GoldenTool, PlantasSDK */
// Capture for the Visor de casas 3D (PlantasSDK global, v3 with the R rules): one event per generated plan.
// Params: seedFrom (1), seedTo (25), states (comma list, default every state), templates (comma list, default all), rows (1 adds the readable rows).
// Items the installations add (the gas bottle) and the paths to outbuildings belong to the structure capture (floorplan-structure.js), not to these lists.
// Each list is hashed from rows of rounded cells, so a package test builds the same rows from its own result and compares one value per list.
(() => {
  const { seed, seedFrom = '1', seedTo = '25', states = '', templates = '', rows: withRows = '0' } = globalThis.__GOLDEN_PARAMS
  const recorder = GoldenTool.createEventRecorder()
  const number = (value) => String(Math.round(value * 1000) / 1000 + 0)
  const cell = (value) => {
    if (typeof value === 'number') return number(value)
    if (Array.isArray(value)) return '[' + value.map(cell).join(',') + ']'
    return value === null || value === undefined ? '-' : String(value)
  }
  const row = (values) => values.map(cell).join('|')
  const itemRow = (item) => row([item.tipo, item.x, item.z, item.y, item.ry, item.w, item.d, item.h, item.fu, item.fv, item.aabb, item.comodo, item.andar, item.externo, item.modo, item.folga, item.plano, item.baixo])

  function listsOf(res) {
    const lot = res.lote
    return {
      rooms: res.comodos.map((room) => row([room.id, room.tipo, room.andar, room.partes, room.liga, room.pe])),
      walls: res.paredes.map((wall) => row([wall.andar, wall.eixo, wall.u0, wall.v0, wall.u1, wall.v1, wall.esp, wall.lados, wall.ext, wall.tipo, wall.h])),
      openings: [
        ...res.portas.map((door) => row(['door', door.andar, door.eixo, door.u, door.v, door.pos, door.c, door.larg, door.a, door.b, door.abre, door.ext, door.lado, door.folhas, door.modelo, door.tipo, door.degraus, door.dobradica, door.zonas, door.bloqueada])),
        ...res.janelas.map((win) => row(['window', win.andar, win.eixo, win.u, win.v, win.pos, win.c, win.larg, win.y0, win.y1, win.comodo, win.lado, win.tabuas])),
        ...res.abertos.map((open) => row(['open', cell(open)])),
      ],
      items: res.moveis.filter((item) => item.tipo !== 'botijao_gas').map(itemRow),
      stateItems: res.estadoItens.map((item) => row([itemRow(item), item.montagem, item.estado])),
      lot: lot
        ? [
            row(['lot', lot.rect, lot.recuo, lot.quintal, lot.estilo, lot.piscina]),
            ...lot.zonas.map((zone) => row(['zone', zone.id, zone.tipo, zone.partes, zone.piso])),
            ...lot.perimetro.map((segment) => row(['perimeter', segment.id, segment.lado, segment.u0, segment.v0, segment.u1, segment.v1, segment.tipo, segment.material, segment.altura, segment.topo, segment.alturaTotal, segment.esp])),
            ...lot.portoes.map((gate) => row(['gate', gate.id, gate.tipo, gate.modelo, gate.u, gate.v, gate.eixo, gate.larg, gate.altura, gate.lado, gate.para, gate.material, gate.aberto])),
            ...lot.caminhos.filter((path) => !/\.edicula\./.test(path.para)).map((path) => row(['path', path.id, path.tipo, path.de, path.para, path.larg, path.rects, path.ponto])),
          ]
        : [],
    }
  }

  const wantedStates = states ? states.split(',') : PlantasSDK.estados
  const wantedTemplates = templates ? templates.split(',') : PlantasSDK.listarTemplates().map((entry) => entry.id)
  for (const template of wantedTemplates) {
    for (let planSeed = Number(seedFrom); planSeed <= Number(seedTo); planSeed++) {
      for (const state of wantedStates) {
        const res = PlantasSDK.gerar(template, { semente: planSeed, estado: state })
        const lists = listsOf(res)
        const hashes = Object.fromEntries(Object.entries(lists).map(([name, listRows]) => [name, GoldenTool.hashText(listRows.join('\n'))]))
        const counts = Object.fromEntries(Object.entries(lists).map(([name, listRows]) => [name, listRows.length]))
        recorder.record('plan', {
          template, seed: planSeed, state, style: res.estilo, w: res.w, d: res.d, floors: res.andares.length, missing: res.faltando.length, counts, hashes,
          ...(withRows === '1' ? { rows: lists } : {}),
        })
      }
    }
  }
  return GoldenTool.createGoldenRecord({ name: 'vc3-floorplan-plans', seed, events: recorder.events() })
})()
