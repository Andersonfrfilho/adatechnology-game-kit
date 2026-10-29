/**
 * Puts the structure of an SDK plan back into the vocabulary of the Visor de casas 3D (Portuguese keys and ids) and hashes it the way
 * tools/golden/captures/floorplan-structure.js does on the page, so both sides hash the same text.
 */
import { hashText } from '@adatechnology/golden-tool'

import idMap from '../../game-floorplan-post-apocalyptic/tests/fixtures/team-golden/vc3-id-map.json'
import type { Structure, StructurePart } from '../src'
import { toDestructibleSpec } from '../src'

type Pairs = readonly (readonly [string, string])[]
const tables = idMap as unknown as { [pack: string]: { [heading: string]: Pairs } }
const inverse = (...lists: Pairs[]): Map<string, string> => new Map(lists.flatMap((pairs) => pairs.map(([team, sdk]) => [sdk, team] as const)))
const direct = (...lists: Pairs[]): Map<string, string> => new Map(lists.flatMap((pairs) => pairs.map(([team, sdk]) => [team, sdk] as const)))

export const sdkTemplateOf = direct(tables.residential!['Template ids']!, tables.commercial!['Template ids']!)
export const sdkStateOf = direct(tables.postApocalyptic!['States']!, [['normal', 'normal']])
const roomIds = inverse(tables.residential!['Room types']!, tables.residential!['Room ids (inside templates)']!, tables.commercial!['Room types']!)

const teamRoom = (id: string): string => roomIds.get(id) ?? id
const teamDoor = (id: string): string => id.replace(/^d(\d+_\d+)$/, 'p$1')

const SIDES: Record<string, string> = { front: 'frente', back: 'fundos', left: 'esq', right: 'dir' }
const ID_RULES: [RegExp, (...groups: string[]) => string][] = [
  [/^ground$/, () => 'chao'],
  [/^wall_(\d+)_(\d+)$/, (f, k) => `w${f}_${k}`],
  [/^plate_(\d+)_(\d+)$/, (f, k) => `prato_${f}_${k}`],
  [/^column_(\d+)_(\d+)$/, (f, k) => `pilar_${f}_${k}`],
  [/^building_column_(\d+)$/, (k) => `pilar_predio_${k}`],
  [/^footing_pier_(\d+)_(\d+)$/, (j, i) => `pilar_fund_${j}_${i}`],
  [/^balcony_column_(.+)$/, (room) => `pilar_sacada_${teamRoom(room!)}`],
  [/^tank_column_(\d+)$/, (k) => `pilar_caixa_${k}`],
  [/^trestle_column_(\d+)$/, (k) => `pilar_cavalete_${k}`],
  [/^post_(\d+)_(\d+)_(\d+)$/, (f, n, k) => `prumo_${f}_${n}_${k}`],
  [/^joist_(\d+)(.*)_(\d+)$/, (f, suffix, k) => `viga_${f}${suffix}_${k}`],
  [/^base_beam_(\d+)$/, (k) => `viga_base_${k}`],
  [/^ceiling_joist_(\d+)$/, (k) => `viga_teto_${k}`],
  [/^porch_beam_(.+?)(_e|_d)?$/, (room, side) => `viga_varanda_${teamRoom(room!)}${side ?? ''}`],
  [/^trestle_beam_(\d+)$/, (k) => `viga_cavalete_${k}`],
  [/^slab_base$/, () => 'laje_base'],
  [/^slab_ceiling$/, () => 'laje_forro'],
  [/^slab_top(.*)$/, (suffix) => `laje_topo${suffix!.startsWith('_') ? '_' + teamRoom(suffix!.slice(1)) : ''}`],
  [/^slab_(\d+)$/, (f) => `laje_${f}`],
  [/^slab_(\d+)_(.+)$/, (f, room) => `laje_${f}_${teamRoom(room!)}`],
  [/^tank_slab$/, () => 'laje_caixa'],
  [/^attic_floor$/, () => 'laje_sotao'],
  [/^foundation_raft$/, () => 'fund_radier'],
  [/^basement_slab$/, () => 'porao_laje'],
  [/^basement_wall_(front|back|left|right)$/, (side) => `porao_parede_${SIDES[side!]}`],
  [/^basement_column_(\d+)$/, (k) => `porao_pilar_${k}`],
  [/^basement_stairs$/, () => 'escada_porao'],
  [/^porch_floor_(.+)$/, (room) => `piso_varanda_${teamRoom(room!)}`],
  [/^porch_footing_(.+)_(\d+)$/, (room, k) => `pier_varanda_${teamRoom(room!)}_${k}`],
  [/^porch_post_(.+)_(\d+)$/, (room, k) => `poste_varanda_${teamRoom(room!)}_${k}`],
  [/^porch_roof_(.+)$/, (room) => `telhado_varanda_${teamRoom(room!)}`],
  [/^steps_(.+)$/, (door) => `escada_${teamDoor(door!)}`],
  [/^stairs_(\d+_\d+)$/, (key) => `escada_${key}`],
  [/^truss(.*)_(\d+)$/, (suffix, k) => `tesoura${suffix!.startsWith('_') ? '_' + teamRoom(suffix!.slice(1)) : ''}_${k}`],
  [/^roof(.*)_(a|b|annex)$/, (suffix, name) => `telhado${suffix!.startsWith('_') ? '_' + teamRoom(suffix!.slice(1)) : ''}_${name === 'annex' ? 'anexo' : name}`],
  [/^water_tank$/, () => 'caixa_dagua'],
  [/^chimney$/, () => 'chamine'],
  [/^well$/, () => 'poco'],
  [/^groundsheet_(.+)$/, (id) => `piso_${id}`],
  [/^canvas_(.+)$/, (id) => `lona_${id}`],
  [/^pole_(.+)$/, (id) => `vareta_${id}`],
  [/^peg_(.+)$/, (id) => `estaca_${id}`],
]

export function teamId(id: string): string {
  for (const [pattern, build] of ID_RULES) {
    const match = pattern.exec(id)
    if (match) return build(...(match.slice(1) as string[]))
  }
  throw new Error(`No team id for "${id}"`)
}

const ROLES: Record<string, string> = { column: 'pilar', beam: 'viga', slab: 'laje', wall: 'parede_portante', partition: 'parede_vedacao', roof: 'telhado', stair: 'escada', none: 'caixa_dagua' }
const JOINTS: Record<string, string> = { tie: 'rope' }
const BEAM_KINDS: Record<string, string> = { plate: 'prato', bond_beam: 'cinta' }

function teamPart(part: StructurePart): Record<string, unknown> {
  const out: Record<string, unknown> = { id: teamId(part.id), role: ROLES[part.role], material: part.material, aabb: part.aabb, y0: part.y0, y1: part.y1, andar: part.floor, massa: part.mass }
  const extras: [keyof StructurePart, string, (value: never) => unknown][] = [
    ['spacing', 'espacamento', (v) => v], ['beamKind', 'tipoViga', (v: string) => BEAM_KINDS[v]], ['steps', 'degraus', (v) => v], ['door', 'porta', (v: string) => teamDoor(v)],
    ['cover', 'cobertura', (v) => v], ['liters', 'capacidade', (v) => v], ['pitch', 'inclinacao', (v) => v], ['tent', 'barraca', (v) => v], ['form', 'forma', (v) => v],
    ['studs', 'montantes', (v: { spacing: number; section: string }) => ({ espacamento: v.spacing, secao: v.section })],
  ]
  for (const [key, teamKey, convert] of extras) if (part[key] !== undefined) out[teamKey] = convert(part[key] as never)
  return out
}

const teamSupport = (s: Structure['supports'][number]): Record<string, unknown> => ({ de: teamId(s.part), sobre: teamId(s.on), tipo: JOINTS[s.joint] ?? s.joint })

const canonical = (value: unknown): unknown => {
  if (typeof value === 'number') return Math.round(value * 1000) / 1000 + 0
  if (Array.isArray(value)) return value.map(canonical)
  if (value === undefined || typeof value === 'function') return null
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical((value as Record<string, unknown>)[key])]))
  return value
}
export const text = (value: unknown): string => JSON.stringify(canonical(value))
export const hashOf = (value: unknown): string => hashText(text(value))
export const hashRows = (list: unknown[]): string => hashText(list.map(text).join('\n'))

function teamSpec(structure: Structure, portico: boolean): { parts: unknown[]; joints: unknown[] } {
  const spec = toDestructibleSpec(structure, { portico, wallDetail: 'coarse', slabPanels: false, rebar: false })
  const parts = spec.parts.map((part) => ({ ...part, id: teamId(part.id), ...(part.tags ? { tags: part.tags.map((tag) => (tag === 'terrain' ? 'terreno' : tag)) } : {}) }))
  const joints = (spec.joints ?? []).map((joint) => ({ id: `${teamId(joint.a)}~${teamId(joint.b)}`, a: teamId(joint.a), b: teamId(joint.b), kind: joint.kind, bears: joint.bears }))
  return { parts, joints }
}

export interface TeamStructureLists {
  pieces: unknown[]
  supports: unknown[]
  coarseParts: unknown[]
  coarseJoints: unknown[]
  enclosureParts: unknown[]
  enclosureJoints: unknown[]
}

export function teamLists(structure: Structure): TeamStructureLists {
  const coarse = teamSpec(structure, false)
  const enclosure = teamSpec(structure, true)
  return {
    pieces: structure.parts.map(teamPart), supports: structure.supports.map(teamSupport),
    coarseParts: coarse.parts, coarseJoints: coarse.joints, enclosureParts: enclosure.parts, enclosureJoints: enclosure.joints,
  }
}

const COVERINGS: Record<string, string> = { fiber_cement: 'fibrocimento', slab: 'laje', asphalt: 'asfaltica', zinc: 'zinco', wood: 'madeira', canvas: 'lona', thatch: 'palha' }
const SHAPES: Record<string, string> = { gable: 'duas_aguas', slab: 'laje', tent: 'tenda' }
const FINISHES: Record<string, string> = { roughcast: 'chapisco', plaster: 'reboco', partial_plaster: 'reboco_parcial', exposed_block: 'bloco_exposto', exposed_brick: 'tijolo_aparente' }
const FLOOR_FINISHES: Record<string, string> = { burnt_cement: 'cimento_queimado', ceramic_tile: 'ceramica' }
const FOUNDATIONS: Record<string, string> = { strip_footing: 'sapata_corrida', building: 'predio' }

const covering = (value: string): string => COVERINGS[value] ?? value

export function teamRoof(roof: Record<string, any>): unknown {
  const panes = (roof.panes as (string | { id: string; aabb: number[]; y0: number; y1: number; flat?: boolean })[]).map((pane) =>
    typeof pane === 'string' ? teamId(pane) : { id: teamId(pane.id), aabb: pane.aabb, y0: pane.y0, y1: pane.y1, ...(pane.flat ? { plana: true } : {}) },
  )
  const out: Record<string, unknown> = { forma: SHAPES[roof.shape], cobertura: covering(roof.covering), material: roof.material, inclinacao: roof.pitch, apoiaEm: roof.bearingFloor, aguas: panes, tesouras: roof.trusses }
  const optional: [string, string][] = [['axis', 'eixo'], ['ridge', 'cumeeira'], ['eave', 'beiral'], ['y0', 'y0'], ['aabb', 'aabb']]
  for (const [key, teamKey] of optional) if (roof[key] !== undefined) out[teamKey] = roof[key]
  return out
}

export function teamConstruction(construction: Record<string, any>): unknown {
  const { walls, floor, roof, frame, foundation } = construction
  return {
    sistema: 'alvenaria',
    parede: { material: walls.material, revestimento: walls.cladding, acabamento: FINISHES[walls.finish] ?? walls.finish, espessura: walls.thickness },
    piso: { material: floor.material, acabamento: FLOOR_FINISHES[floor.finish] ?? floor.finish },
    telhado: { material: roof.material, cobertura: covering(roof.covering), forma: SHAPES[roof.shape], inclinacao: roof.pitch, madeiramento: roof.timber },
    estrutura: { material: frame.material, pilares: frame.pillars, vigas: frame.beams, lajes: frame.slabs, madeiramento: frame.timber, armadura: frame.rebar },
    fundacao: { tipo: FOUNDATIONS[foundation.type] ?? foundation.type, material: foundation.material, elevacao: foundation.elevation },
  }
}

const TANK_PLACES: Record<string, string> = { slab: 'laje', attic: 'sotao', raised_slab: 'laje_caixa', trestle: 'cavalete' }

export function teamTank(tank: Record<string, any> | null): unknown {
  if (!tank) return null
  const out: Record<string, unknown> = { id: 'caixa_dagua', tipo: 'caixa_dagua', tipoItem: 'caixa_dagua', local: TANK_PLACES[tank.place], andar: tank.floor, comodo: teamRoom(tank.room), u: tank.u, v: tank.v, y: tank.y, w: tank.w, d: tank.d, h: tank.h, capacidade: tank.capacity, aabb: tank.aabb }
  if (tank.platform) {
    const p = tank.platform
    out.plataforma = { aabb: p.aabb, yBase: p.baseY, altura: p.height, espessura: p.thickness, yTopo: p.topY, pilares: p.pillars.map((q: any) => ({ u: q.u, v: q.v, lado: q.side })), escada: p.ladder }
  }
  return out
}
