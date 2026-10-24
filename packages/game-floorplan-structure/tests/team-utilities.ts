/**
 * Puts the installations of an SDK plan (gas, electricity, solar, plumbing, outbuildings and the paths to them) back into the vocabulary of the
 * Visor de casas 3D. Item ids come back by position: the golden records the ids of every plan's items in order (`vc3-item-ids.json`).
 */
import idMap from '../../game-floorplan-post-apocalyptic/tests/fixtures/team-golden/vc3-id-map.json'

type Loose = { [key: string]: any }
type Pairs = readonly (readonly [string, string])[]
const tables = idMap as unknown as { [pack: string]: { [heading: string]: Pairs } }
const inverse = (...lists: Pairs[]): Map<string, string> => new Map(lists.flatMap((pairs) => pairs.map(([team, sdk]) => [sdk, team] as const)))

const roomIds = inverse(tables.residential!['Room types']!, tables.residential!['Room ids (inside templates)']!, tables.commercial!['Room types']!)
const itemTypes = inverse(tables.residential!['Item types (residential)']!, tables.commercial!['Item types (commercial)']!)
const itemCategories = inverse(tables.residential!['Item categories (residential)']!, tables.commercial!['Item categories (commercial)']!)
const vocabulary = inverse(tables.engine!['Miscellaneous vocabulary']!, tables.engine!['Mounts (`montagem`)']!)

const SIDE: Record<string, string> = { front: 'frente', back: 'fundos', left: 'esq', right: 'dir' }
const PLACEMENT: Record<string, string> = { beside: 'ao_lado', external_niche: 'nicho_externo', under_counter: 'sob_bancada' }
const POINT_KIND: Record<string, string> = { tap: 'torneira', shower: 'chuveiro', flush: 'descarga', tub: 'tanque', machine: 'maquina' }
const RUN_EXPOSURE: Record<string, string> = { tank_outlet: 'saida_caixa', under_sink: 'sob_pia', wall: 'parede' }
const USE: Record<string, string> = { guest_room: 'quarto_visita', office: 'escritorio', storage: 'deposito', gourmet: 'gourmet' }
const OUTBUILDING_NAMES: Record<string, string> = {
  cama_solteiro: 'Cama de solteiro', criado: 'Criado-mudo', escrivaninha: 'Escrivaninha', estante_peq: 'Estante', estante_ferr: 'Estante de ferramentas', caixote: 'Caixote', mesa_peq: 'Mesa', bancada_ferr: 'Bancada',
}

const teamRoom = (id: string): string => roomIds.get(id) ?? id
const teamDoor = (id: string): string => id.replace(/^d(\d+_\d+)$/, 'p$1')
const teamType = (type: string): string => itemTypes.get(type) ?? type
const teamCategory = (category: string): string => itemCategories.get(category) ?? itemTypes.get(category) ?? category
const teamColor = (color: unknown): unknown => (typeof color === 'string' ? (vocabulary.get(color) ?? color) : color)

export function teamUtilities(result: Loose, teamIds: readonly string[]): Loose {
  const sdkItems = (result.items as Loose[]).filter((item) => item.type !== 'cooking_gas_cylinder')
  const idByItem = new Map(sdkItems.map((item, index) => [item.id as string, teamIds[index]!]))
  const itemId = (id: string): string => idByItem.get(id) ?? `${teamRoom(id.split('.')[0]!)}.botijao_gas`
  const switchOrOutlet = (id: string): string => id.replace(/^outlet/, 'tom').replace(/^switch/, 'int')
  const pointId = (id: string): string =>
    id.startsWith('outdoor_') ? `ext_${teamDoor(id.slice('outdoor_'.length))}` : /^(outlet|switch)\d+$/.test(id) ? switchOrOutlet(id) : id.startsWith('circuit_') ? circuitId(id) : id
  const circuitId = (id: string): string => {
    const [, room, floor] = /^circuit_(.+)_(-?\d+)$/.exec(id)!
    return `circ_${teamRoom(room!)}_${floor}`
  }
  const lampId = (id: string): string => (idByItem.has(id) ? idByItem.get(id)! : pointId(id))
  const u = result.utilities as Loose
  const gasBottles = sdkItems.length === (result.items as Loose[]).length ? [] : (result.items as Loose[]).filter((item) => item.type === 'cooking_gas_cylinder').map((item) => bottle(item))
  function bottle(item: Loose): Loose {
    const out: Loose = {
      id: itemId(item.id), tipo: 'botijao_gas', categoria: 'botijao_gas', x: item.x, z: item.z, ry: item.ry, w: item.w, d: item.d, h: item.h, y: item.y, fu: -item.link ? item.frontU : item.frontU, fv: item.frontV, comodo: teamRoom(item.room),
      andar: item.floor, externo: item.outdoor, slot: 'botijao', sobre: item.on ? itemId(item.on) : null, modo: null, folga: 0, plano: false, baixo: false, aabb: item.aabb, liga: itemId(item.link),
      local: PLACEMENT[item.placement], mangueira: item.hose, capacidade_kg: item.capacityKg, cor: teamColor(item.color),
    }
    if (item.hidden) out.oculto = true
    return out
  }
  return {
    gas: u.gas ? { tipo: u.gas.type === 'piped' ? 'encanado' : 'botijao', medidor: u.gas.meter ? gasMeter(u.gas.meter) : null } : null,
    gasBottles,
    electrical: electrical(u.electrical, { itemId, pointId, circuitId, lampId }),
    solar: u.solar ? solar(u.solar) : null,
    plumbing: plumbing(u.plumbing, itemId),
    outbuildings: (result.outbuildings as Loose[]).map((b) => outbuilding(b, itemId)),
    outbuildingPaths: result.lot ? outbuildingPaths(result, itemId) : [],
  }
}

const gasMeter = (m: Loose): Loose => ({ id: 'gas.medidor', u: m.u, v: m.v, y: m.y, lado: SIDE[m.side], w: m.w, d: m.d, h: m.h })

interface Ids {
  itemId(id: string): string
  pointId(id: string): string
  circuitId(id: string): string
  lampId(id: string): string
}

function electrical(e: Loose, ids: Ids): Loose {
  const place: Record<string, string> = { gate_pillar: 'pilar_portao', facade: 'fachada' }
  const meter = (m: Loose | null): Loose | null => (m ? { id: 'medidor', local: place[m.place], u: m.u, v: m.v, y: m.y, lado: SIDE[m.side], w: m.w, d: m.d, h: m.h } : null)
  const entrance = (s: Loose | null): Loose | null => {
    if (!s) return null
    const out: Loose = { poste: s.pole, ramal: s.drop, medidor: meter(s.meter), descida: s.descent, ramalInterno: s.internalRun }
    if (s.tap) {
      out.gato = true
      out.ligacao = s.connection
    }
    return out
  }
  const out: Loose = {
    modo: e.mode === 'grid' ? 'rede' : e.mode === 'tap' ? 'gato' : 'offgrid', entradaEnergia: entrance(e.serviceEntrance),
    quadro: e.panel ? { id: 'quadro', comodo: teamRoom(e.panel.room), andar: e.panel.floor, u: e.panel.u, v: e.panel.v, y: e.panel.y, c: e.panel.c, eixo: e.panel.axis, pos: e.panel.pos, fu: e.panel.frontU, fv: e.panel.frontV, w: e.panel.w, h: e.panel.h, disjuntores: e.panel.breakers } : null,
    tomadas: e.outlets.map((t: Loose) => ({ id: ids.pointId(t.id), comodo: teamRoom(t.room), andar: t.floor, u: t.u, v: t.v, y: t.y, c: t.c, eixo: t.axis, pos: t.pos, fu: t.frontU, fv: t.frontV, tipo: t.type, tensao: t.voltage })),
    interruptores: e.switches.map((s: Loose) => ({ id: ids.pointId(s.id), comodo: teamRoom(s.room), andar: s.floor, u: s.u, v: s.v, y: s.y, c: s.c, eixo: s.axis, pos: s.pos, fu: s.frontU, fv: s.frontV, porta: teamDoor(s.door), ladoTrinco: s.latchSide, controla: s.controls.map(ids.lampId) })),
    circuitos: e.circuits.map((c: Loose) => ({ id: ids.circuitId(c.id), comodo: teamRoom(c.room), andar: c.floor, tomadas: c.outlets.map(ids.pointId), interruptores: c.switches.map(ids.pointId), lampadas: c.lamps.map(ids.itemId), exposto: c.exposed, bitola_mm2: c.gauge_mm2 })),
    eletrodutos: e.conduits.map((c: Loose) => ({ id: `ed_${ids.pointId(c.id.replace(/^conduit_/, ''))}`, circuito: ids.circuitId(c.circuit), de: c.from === 'panel' ? 'quadro' : ids.circuitId(c.from), para: c.from === 'panel' ? teamRoom(c.to) : ids.pointId(c.to), exposto: c.exposed, diametro: c.diameter, pontos: c.points })),
    exposta: e.exposed,
    lampadasExternas: e.outdoorLamps.map((l: Loose) => ({ id: ids.pointId(l.id), u: l.u, v: l.v, y: l.y, porta: teamDoor(l.door), interruptor: l.switch ? ids.pointId(l.switch) : null })),
  }
  if (e.source) out.fonte = e.source === 'solar' ? 'solar' : 'lampiao'
  return out
}

function solar(s: Loose): Loose {
  const inverter = s.inverter ? { id: 'inversor', u: s.inverter.u, v: s.inverter.v, y: s.inverter.y, lado: SIDE[s.inverter.side], w: s.inverter.w, d: s.inverter.d, h: s.inverter.h, externo: s.inverter.outdoor, liga: 'quadro' } : null
  return {
    tipo: s.type === 'slab_rack' ? 'rack_laje' : 'telhado', orientacao: 'norte', norte: SIDE[s.north], ladoVertente: s.slopeSide ? SIDE[s.slopeSide] : null, inclinacao: s.tilt, area: s.area, areaM2: s.areaM2, n: s.count, andar: s.floor, y: s.y,
    paineis: s.panels.map((p: Loose) => ({ id: p.id, u: p.u, v: p.v, w: p.w, d: p.d, comp: p.length })), inversor: inverter,
  }
}

function plumbing(p: Loose, itemId: (id: string) => string): Loose {
  const runId = (id: string): string => {
    if (id === 'run_outlet') return 'tr_saida'
    if (id.startsWith('run_under_')) return `tr_sob_${id.slice('run_under_'.length)}`
    const [, room, suffix] = /^run_wall_(.+?)(_outside|_-?\d+)$/.exec(id)!
    return `tr_parede_${teamRoom(room!)}${suffix === '_outside' ? '_ext' : suffix}`
  }
  const endpoint = (value: string): string => (value === 'water_tank' ? 'caixa_dagua' : value === 'ceiling' ? 'forro' : value === 'valve' ? 'registro' : roomIds.has(value) ? teamRoom(value) : value)
  return {
    caixa: p.tank ? 'caixa_dagua' : null, capacidade_l: p.capacityL,
    pontos: p.points.map((pt: Loose) => ({ id: pt.id, tipo: POINT_KIND[pt.kind], item: itemId(pt.item), comodo: teamRoom(pt.room), andar: pt.floor, u: pt.u, v: pt.v, y: pt.y, vazao_lpm: pt.flowLpm, trecho: pt.run ? runId(pt.run) : null })),
    trechosVisiveis: p.visibleRuns.map((r: Loose) => ({ id: runId(r.id), de: endpoint(r.from), para: endpoint(r.to), pontos: r.points, diametro: r.diameter, exposto: RUN_EXPOSURE[r.exposed] })),
  }
}

function outbuilding(b: Loose, itemId: (id: string) => string): Loose {
  const opening = (o: Loose, kind: 'door' | 'window'): Loose => ({
    id: itemId(o.id.replace(/\.[dw]\d+$/, '')) + o.id.replace(/^.*\.(d|w)(\d+)$/, (_m: string, k: string, n: string) => `.${k === 'd' ? 'p' : 'j'}${n}`), eixo: o.axis, pos: o.pos, u: o.u, v: o.v, c: o.at, larg: o.width, lado: SIDE[o.side],
    ...(kind === 'door' ? { h: o.height, ext: o.exterior, zona: o.zone } : { y0: o.y0, y1: o.y1 }),
  })
  return {
    id: itemId(b.id), tipo: 'edicula', uso: USE[b.use], andar: b.floor, aabb: b.aabb, interior: b.interior, pe: b.ceiling, esp: b.thickness, frente: b.front,
    paredes: b.walls.map((w: Loose) => ({ eixo: w.axis, u0: w.u0, v0: w.v0, u1: w.u1, v1: w.v1, esp: w.thickness, h: w.h, lado: SIDE[w.side] })),
    portas: b.doors.map((o: Loose) => opening(o, 'door')), janelas: b.windows.map((o: Loose) => opening(o, 'window')),
    itens: b.items.map((i: Loose) => ({ tipo: teamType(i.type), nome_pt: OUTBUILDING_NAMES[teamType(i.type)], categoria: teamCategory(i.category), u: i.u, v: i.v, w: i.w, d: i.d, h: i.h, ry: i.ry, fu: i.frontU, fv: i.frontV, aabb: i.aabb })),
  }
}

function outbuildingPaths(result: Loose, itemId: (id: string) => string): Loose[] {
  const doors = new Set((result.outbuildings as Loose[]).flatMap((b) => (b.doors as Loose[]).map((d) => d.id as string)))
  const doorId = (id: string): string => itemId(id.replace(/\.d\d+$/, '')) + `.p${id.replace(/^.*\.d(\d+)$/, '$1')}`
  return (result.lot.paths as Loose[]).filter((p) => doors.has(p.to)).map((p) => ({ id: `cam_${doorId(p.to)}`, tipo: 'pedestre', de: p.from, para: doorId(p.to), larg: p.width, rects: p.rects, ponto: p.points }))
}
