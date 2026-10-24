/**
 * Puts an SDK plan back into the team's vocabulary (PlantasSDK of the Visor de casas 3D) and writes the same rows that
 * tools/golden/captures/floorplan-plans.js writes on the page, so both sides hash the same text.
 */
import idMap from './fixtures/team-golden/vc3-id-map.json'

type Pairs = readonly (readonly [string, string])[]
type Table = { [heading: string]: Pairs }

const tables = idMap as unknown as { [pack: string]: Table }
const inverse = (...pairLists: Pairs[]): Map<string, string> => new Map(pairLists.flatMap((pairs) => pairs.map(([team, sdk]) => [sdk, team] as const)))
const direct = (...pairLists: Pairs[]): Map<string, string> => new Map(pairLists.flatMap((pairs) => pairs.map(([team, sdk]) => [team, sdk] as const)))

const ruralTemplates = tables.rural!['Template ids']!
const itemTypes = inverse(
  tables.residential!['Item types (residential)']!,
  tables.commercial!['Item types (commercial)']!,
  tables.postApocalyptic!['Item types of this pack']!,
  tables.postApocalyptic!['State item types (`estadoItens`, now `stateItems`)']!,
  tables.rural!['Item types (rural)']!,
  tables.engine!['Engine-level item types and categories (ground cover)']!.slice(0, 8),
)
const roomIds = inverse(
  tables.residential!['Room types']!,
  tables.residential!['Room ids (inside templates)']!,
  tables.commercial!['Room types']!,
  tables.rural!['Room types']!,
  tables.rural!['Room ids (inside templates)']!,
  [['caixas', 'checkouts']],
)
const templates = inverse(tables.residential!['Template ids']!, tables.commercial!['Template ids']!, ruralTemplates)
export const sdkTemplateOf = direct(tables.residential!['Template ids']!, tables.commercial!['Template ids']!, ruralTemplates)
export const sdkStateOf = direct(tables.postApocalyptic!['States']!, [['normal', 'normal']])
const styles = inverse(tables.residential!['Styles, tiers']!, tables.commercial!['Style']!)
const vocabulary = inverse(tables.engine!['Miscellaneous vocabulary']!, tables.engine!['Anchors']!, tables.engine!['Facing (`frente`)']!, tables.engine!['Sides and corners']!, tables.engine!['Mounts (`montagem`)']!, tables.engine!['Lot zone types, wall tops, gates, doors, finishes']!, tables.rural!['Door models and types']!, tables.rural!['Lot zone types']!)

const SIDES = new Map([['front', 'frente'], ['back', 'fundos'], ['left', 'esq'], ['right', 'dir']])
const BOUNDARY = new Map([['wall', 'muro'], ['fence', 'cerca'], ['railing', 'grade']])
// The MIGRATION prose lists these in sentences, not tables
const PROSE = new Map([['none', 'nada'], ['glass', 'caco'], ['razor_wire', 'concertina'], ['barbed_wire', 'arame_farpado'], ['pedestrian', 'social'], ['garage', 'garagem'], ['cargo', 'carga']])
const PATHS = new Map([['pedestrian_path', 'cam_social'], ['garage_path', 'cam_garagem'], ['cargo_path', 'cam_carga'], ['entrance_path', 'cam_entrada']])

const word = (map: Map<string, string>) => (value: unknown): unknown => (typeof value === 'string' ? (map.get(value) ?? value) : value)
const teamRoom = word(roomIds)
const teamType = word(itemTypes)
const teamWord = word(vocabulary)
const teamTop = (value: unknown): unknown => (value === 'railing' ? 'grade' : teamProse(value))
const teamStyle = word(styles)
const teamProse = word(PROSE)
const teamSide = word(SIDES)
const teamBoundary = word(BOUNDARY)
const teamOpeningId = (id: unknown): unknown => (typeof id === 'string' ? (PATHS.get(id) ?? id.replace(/^path_d(\d+_\d+)$/, 'cam_p$1').replace(/^d(\d+_\d+)$/, 'p$1').replace(/^w(\d+_\d+)$/, 'j$1')) : id)

export const teamTemplateOf = (sdkTemplate: string): string => templates.get(sdkTemplate) ?? sdkTemplate

function number(value: number): string {
  return String(Math.round(value * 1000) / 1000 + 0)
}

function cell(value: unknown): string {
  if (typeof value === 'number') return number(value)
  if (Array.isArray(value)) return '[' + value.map(cell).join(',') + ']'
  return value === null || value === undefined ? '-' : String(value)
}

const row = (values: readonly unknown[]): string => values.map(cell).join('|')

type Loose = { [key: string]: any }

function itemRow(item: Loose): string {
  const { type, x, z, y, ry, w, d, h, frontU, frontV, aabb, floor, outdoor, clearance, flat, low } = item
  return row([teamType(type), x, z, y, ry, w, d, h, frontU, frontV, aabb, teamRoom(item.room), floor, outdoor, item.mode === null ? null : teamWord(item.mode), clearance, flat, low])
}

function lotRows(lot: Loose | null): string[] {
  if (!lot) return []
  return [
    row(['lot', lot.rect, lot.setback, lot.backyard, teamStyle(lot.style), lot.pool]),
    ...lot.zones.map((zone: Loose) => row(['zone', teamRoom(zone.id), teamWord(zone.type), zone.parts, teamType(zone.ground)])),
    ...lot.perimeter.map((s: Loose) => row(['perimeter', s.id, teamSide(s.side), s.u0, s.v0, s.u1, s.v1, teamBoundary(s.type), teamWord(s.material), s.height, teamTop(s.top), s.totalHeight, s.thickness])),
    ...lot.gates.map((g: Loose) => row(['gate', g.id, teamProse(g.type), teamWord(g.model), g.u, g.v, g.axis, g.width, g.height, teamSide(g.side), teamRoom(teamWord(g.to)), teamWord(g.material), g.open])),
    ...lot.paths.map((p: Loose) => row(['path', teamOpeningId(p.id), teamWord(p.type), teamOpeningId(p.from), teamOpeningId(p.to), p.width, p.rects, p.points])),
  ]
}

export type PlanLists = { [list: string]: string[] }

export function teamRowsOf(plan: Loose): PlanLists {
  return {
    rooms: plan.rooms.map((room: Loose) => row([teamRoom(room.id), teamRoom(room.type), room.floor, room.parts, room.link, room.ceiling])),
    walls: plan.walls.map((wall: Loose) => row([wall.floor, wall.axis, wall.u0, wall.v0, wall.u1, wall.v1, wall.thickness, wall.sides.map(teamRoom), wall.exterior, teamWord(wall.type), wall.h])),
    openings: [
      ...plan.doors.map((door: Loose) => row(['door', door.floor, door.axis, door.u, door.v, door.pos, door.at, door.width, teamRoom(door.a), teamRoom(door.b), teamRoom(door.opensTo), door.exterior, teamSide(door.side), door.leaves, teamWord(door.model), teamWord(door.type), door.steps ?? 0, teamWord(door.hinge), door.zones, door.blocked])),
      ...plan.windows.map((win: Loose) => row(['window', win.floor, win.axis, win.u, win.v, win.pos, win.at, win.width, win.y0, win.y1, teamRoom(win.room), teamSide(win.side), win.boards])),
      ...plan.openPairs.map((open: readonly string[]) => row(['open', cell(open.map(teamRoom))])),
    ],
    items: plan.items.map(itemRow),
    stateItems: plan.stateItems.map((item: Loose) => row([itemRow(item), teamWord(item.mount), item.state === 'fortified' ? 'protegida' : item.state === 'abandoned' ? 'abandonada' : item.state])),
    lot: lotRows(plan.lot),
  }
}
