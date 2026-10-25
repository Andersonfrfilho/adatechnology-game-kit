import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

import { LEGACY_CONTENT, LEGACY_TYPE } from './legacy-names'

// Test-only. The team's `AdaptadorInterativos` reads the team's `res` (Portuguese, shaped by the PlantasSDK). The kit's plan has the same facts with English names and a few
// different shapes (contents in `result.contents`, installations in `result.utilities`). `teamShape` rebuilds the team's `res` from a plan of the kit, and `toKit` renames what
// the team's adapter answers, so both adapters can be compared on the same house.

const here = dirname(fileURLToPath(import.meta.url))
export const TEAM_ADAPTER_PATH = join(here, '..', 'fixtures', 'team-golden', 'adaptador-interativos.js')

type Json = any

/** The team's IIFE, evaluated in a fresh vm context (no globals: the kit enters through `criar`). */
export function loadTeamAdapter(): Json {
  const code = readFileSync(TEAM_ADAPTER_PATH, 'utf8')
  return vm.runInNewContext(`${code}\n;AdaptadorInterativos`, Object.create(null), { filename: 'adaptador-interativos.js' })
}

const STATE: Record<string, string> = { normal: 'normal', fortified: 'protegida', abandoned: 'abandonada' }
const ROLE: Record<string, string> = { wood: 'madeira', fabric_main: 'tecido_principal', fabric_accent: 'tecido_acento', metal: 'metal' }
const GROUP: Record<string, string> = {
  food: 'comida', water: 'agua', medicine: 'remedio', tool: 'ferramenta', improvised_weapon: 'arma_improvisada', clothes: 'roupa', document: 'documento', cleaning: 'limpeza', trash: 'lixo', utensil: 'utensilio',
}
const POINT_KIND: Record<string, string> = { tap: 'torneira', shower: 'chuveiro', flush: 'descarga', tub: 'tanque', machine: 'maquina' }
const PLACE: Record<string, string> = { beside: 'ao_lado', external_niche: 'nicho_externo', under_counter: 'sob_bancada' }
const MODE: Record<string, string> = { grid: 'rede', tap: 'gato', offgrid: 'offgrid' }

// the team told frozen meat by its name
const stackOf = (s: Json): Json => ({ tipo: LEGACY_CONTENT[s.itemId] ?? `novo_${s.itemId}`, nome_pt: s.itemId === 'frozen_meat' ? 'Carne congelada' : s.itemId, categoria: s.group ? GROUP[s.group] : undefined, qtd: s.count, pegavel: s.pickable })

export function teamShape(r: Json): Json {
  const u = r.utilities || {}
  const e = u.electrical
  const colors: Json = {}
  for (const [k, v] of Object.entries(r.colors || {})) colors[ROLE[k] ?? k] = v
  const items: Json[] = r.items.map((m: Json) => {
    const o: Json = {
      id: m.id, tipo: LEGACY_TYPE[m.type] ?? m.type, categoria: m.category, x: m.x, z: m.z, ry: m.ry, w: m.w, d: m.d, h: m.h, y: m.y, fu: m.frontU, fv: m.frontV,
      cor: typeof m.color === 'string' ? (ROLE[m.color] ?? m.color) : m.color, andar: m.floor, externo: m.outdoor, decor: m.decor, plano: m.flat, aabb: m.aabb, comodo: m.room,
    }
    if (r.contents[m.id]) o.conteudo = r.contents[m.id].map(stackOf)
    if (r.contents[`${m.id}#overhead`]) o.conteudoAereo = r.contents[`${m.id}#overhead`].map(stackOf)
    if (m.overhead === false) o.aereo = false
    if (m.outlet) o.tomada = m.outlet
    if (m.showerHeater) o.chuveiro = { eletrico: m.showerHeater.electric, potencia_w: m.showerHeater.powerW, tomada: m.showerHeater.outlet }
    if (m.category === 'stove') {
      o.gas = m.gas === 'piped' ? 'encanado' : 'botijao'
      o.botijao = m.cylinder ?? null
    }
    if (m.link) o.liga = m.link
    if (m.placement) o.local = PLACE[m.placement]
    return o
  })
  const res: Json = {
    template: r.template,
    semente: r.seed,
    estado: STATE[r.state] ?? r.state,
    cores: colors,
    andares: r.floors.map((f: Json) => ({ indice: f.index, y0: f.y0, pe: f.ceiling })),
    comodos: r.rooms.map((c: Json) => ({ id: c.id, andar: c.floor, pe: c.ceiling })),
    paredes: r.walls.map((p: Json) => ({ andar: p.floor, eixo: p.axis, esp: p.thickness, u0: p.u0, v0: p.v0, u1: p.u1, v1: p.v1 })),
    moveis: items,
  }
  if (e) {
    res.energia = { iluminacao: e.mode === 'offgrid' ? 'lampiao' : 'eletrica' }
    const ee = e.serviceEntrance
    res.eletrica = {
      modo: MODE[e.mode],
      entradaEnergia: ee ? { poste: ee.pole, ramal: ee.drop, medidor: ee.meter ?? null, descida: ee.descent, gato: !!ee.tap } : null,
      quadro: e.panel ? { id: 'quadro', andar: e.panel.floor, u: e.panel.u, v: e.panel.v, y: e.panel.y, fu: e.panel.frontU, fv: e.panel.frontV } : null,
      tomadas: e.outlets.map((t: Json) => ({ id: t.id, andar: t.floor, u: t.u, v: t.v, y: t.y, fu: t.frontU, fv: t.frontV })),
      interruptores: e.switches.map((s: Json) => ({ id: s.id, andar: s.floor, u: s.u, v: s.v, y: s.y, fu: s.frontU, fv: s.frontV, controla: s.controls })),
      circuitos: e.circuits.map((c: Json) => ({ id: c.id, comodo: c.room, andar: c.floor, tomadas: c.outlets, interruptores: c.switches, lampadas: c.lamps })),
      eletrodutos: e.conduits.map((c: Json) => ({ id: c.id, exposto: c.exposed, pontos: c.points, circuito: c.circuit })),
      lampadasExternas: e.outdoorLamps,
    }
  }
  const camp = items.find((m) => m.tipo === 'fogareiro')
  const canister = items.find((m) => m.tipo === 'botijao_camping')
  if (u.gas || camp || canister) res.gas = { medidor: u.gas ? u.gas.meter : null, ...(camp || canister ? { fogareiro: camp ? camp.id : null, botijao: canister ? canister.id : null } : {}) }
  if (u.plumbing) res.hidraulica = { pontos: u.plumbing.points.map((p: Json) => ({ id: p.id, tipo: POINT_KIND[p.kind], item: p.item, vazao_lpm: p.flowLpm })) }
  const ch = r.structureExtras && r.structureExtras.chimney
  if (ch) {
    const fire = r.items.find((m: Json) => m.type === 'fireplace')
    const stove = r.items.find((m: Json) => m.type === 'wood_stove')
    res.chamine = { ...(ch.kind === 'fireplace' ? { lareira: fire && fire.id } : { fogao: stove && stove.id }), material: ch.material, aabb: ch.aabb, altura: ch.height ?? ch.top }
  }
  return res
}

// ---- the team's answer, with the kit's names ----
const KEYS: Record<string, string> = {
  versao: 'version', itens: 'items', tomadas: 'outlets', interruptores: 'switches', luzes: 'lights', lampioes: 'lanterns', entradaEnergia: 'serviceEntrance', quadro: 'panel', medidor: 'meter',
  conduites: 'conduits', botijoes: 'cylinders', fogoes: 'stoves', pontos: 'points', mapeados: 'mapped', cadeiras: 'chairs', naoMapeados: 'unmapped', descartados: 'discarded', avisos: 'warnings',
  origem: 'origin', andar: 'floor', piso: 'floorY', ligacoes: 'connections', ligada: 'lit', tipo: 'type', chuveiro: 'shower', tomada: 'outlet', botijao: 'cylinder', circuito: 'circuit', controla: 'controls',
  topoChamine: 'chimneyTop', vazao_lpm: 'flowLpm', circuitoTomada: 'outletCircuit', ponto: 'point', afastado: 'moved', afastados: 'moved', objeto: 'object', tipoPonto: 'pointKind', fogao: 'stove', local: 'place',
  eletrico: 'electric', potencia_w: 'powerW', pegavel: 'pickable', categoria: 'group', substituto_de: 'substituteFor', semente: 'seed', adicionados: 'added', partes: 'parts', dobradicas: 'hinges',
  parte: 'part',
}
// ids and words the adapter renamed
const IDS: [RegExp, string][] = [
  [/\bentrada_energia\b/g, 'service_entrance'], [/\bgas_encanado\b/g, 'piped_gas'], [/\bconduite_descida\b/g, 'conduit_descent'], [/\bcircuito_avulso\b/g, 'standalone_circuit'],
  [/\bquadro\b/g, 'panel'], [/\bmedidor\b/g, 'meter'], [/#aereo\b/g, '#overhead'], [/#armario\b/g, '#cabinet'], [/#cadeira(\d)/g, '#chair$1'],
]
const VALUES: Record<string, Record<string, string>> = {
  gas: { botijao: 'cylinder', encanado: 'piped' },
  place: { ao_lado: 'beside', nicho_externo: 'external_niche', sob_bancada: 'under_counter' },
  pointKind: Object.fromEntries(Object.entries(POINT_KIND).map(([k, v]) => [v, k])),
  group: Object.fromEntries(Object.entries(GROUP).map(([k, v]) => [v, k])),
}
const renameId = (s: string): string => IDS.reduce((t, [re, to]) => t.replace(re, to), s)

const KIT_TYPE = Object.fromEntries(Object.entries(LEGACY_TYPE).map(([k, v]) => [v, k]))

/** The team's answer of `planejar` with the kit's names (`unmapped` keys carry the team's `tipo`, which goes back to the kit's). */
export function planToKit(answer: Json): Json {
  const out = toKit(answer)
  out.unmapped = Object.fromEntries(Object.entries(out.unmapped).map(([k, v]) => [k.replace(/\/(.*)$/, (_m, t: string) => `/${KIT_TYPE[t] ?? t}`), v]))
  return out
}

export function toKit(value: Json, key?: string): Json {
  if (Array.isArray(value)) return value.map((v) => toKit(v, key))
  if (value && typeof value === 'object') {
    const out: Json = {}
    for (const [k, v] of Object.entries(value)) {
      if (k === 'nome_pt') continue // the kit's stacks carry no Portuguese name
      if (k === 'origem' && 'pegavel' in value) continue // data.origem is the team's `tipo` of the stack; the kit's `source` is the item id (checked on its own)
      const nk = KEYS[k] ?? k
      // keys of dictionaries keyed by ids (`points`, `afastados`): ids are renamed
      out[nk === k ? renameId(k) : nk] = toKit(v, nk)
    }
    return out
  }
  if (typeof value === 'string') {
    if (key && VALUES[key] && VALUES[key]![value]) return VALUES[key]![value]
    return renameId(value)
  }
  return value
}

/**
 * A serialized world with the names of both adapters made the same: the ids the adapter created itself, and the data of the stacks (`source`, `origem`, `nome_pt`, `group`,
 * `categoria` are dropped: the Portuguese ones have no counterpart; the kit's own are checked on their own).
 */
export function normalizeWorld(value: Json): Json {
  if (Array.isArray(value)) return value.map(normalizeWorld)
  if (value && typeof value === 'object') {
    const out: Json = {}
    for (const [k, v] of Object.entries(value)) {
      if (k === 'source' || k === 'origem' || k === 'nome_pt' || k === 'group' || k === 'categoria') continue
      const nk = k === 'pegavel' ? 'pickable' : k === 'substituto_de' ? 'substituteFor' : renameId(k)
      out[nk] = normalizeWorld(v)
    }
    return out
  }
  return typeof value === 'string' ? renameId(value) : value
}

/** The salt of the seeded random the team's adapter used for the ids it created itself (the kit's `seedKey` option gives it back). */
export const teamSeedKey = (id: string): string =>
  id
    .replace(/^service_entrance$/, 'entrada_energia')
    .replace(/^piped_gas$/, 'gas_encanado')
    .replace(/^panel$/, 'quadro')
    .replace(/^meter$/, 'medidor')
    .replace(/^conduit_descent$/, 'conduite_descida')
    .replace(/#overhead$/, '#aereo')
    .replace(/#cabinet$/, '#armario')
    .replace(/#chair(\d)$/, '#cadeira$1')

/** Removes the `source` of the stacks (the team's answer has the team's `tipo` there). */
export function withoutSource(value: Json): Json {
  if (Array.isArray(value)) return value.map(withoutSource)
  if (value && typeof value === 'object') {
    const out: Json = {}
    for (const [k, v] of Object.entries(value)) if (k !== 'source') out[k] = withoutSource(v)
    return out
  }
  return value
}
