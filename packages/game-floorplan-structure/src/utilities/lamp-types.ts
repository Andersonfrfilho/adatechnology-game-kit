import type { Plan, ResultItem } from '@adatechnology/game-floorplan'

/** The lamp a lighting point holds, and so the socket that is wired for it: a screw-in bulb, a tube between two lampholders, a flush ceiling base, a wall base. */
export type LampType = 'bulb_e27' | 'tube_t8' | 'plafon' | 'sconce'

/** A lighting point of the installation: where its socket goes and which lamp it holds. */
export interface LightPoint {
  id: string
  room: string
  floor: number
  lamp: LampType
}

/** The lamp of the ceiling point of each room type; a room that is not listed has a plain bulb. A batten for the working rooms, a flush base where it is damp or a passage. */
export const LAMP_TYPE_BY_ROOM: Readonly<Record<string, LampType>> = {
  kitchen: 'tube_t8',
  service: 'tube_t8',
  laundry: 'tube_t8',
  garage: 'tube_t8',
  stockroom: 'tube_t8',
  workshop: 'tube_t8',
  bathroom: 'plafon',
  toilet: 'plafon',
  hall: 'plafon',
  corridor: 'plafon',
}

export const DEFAULT_LAMP_TYPE = 'bulb_e27' satisfies LampType

/** The lamp of the porch light beside a door. */
export const OUTDOOR_LAMP_TYPE: LampType = 'sconce'

/** An outbuilding (the edicula) is lit by a batten whatever use it is given. */
export const OUTBUILDING_LAMP_TYPE: LampType = 'tube_t8'

export const lampTypeOfRoom = (roomType: string, isOutbuilding = false): LampType =>
  isOutbuilding ? OUTBUILDING_LAMP_TYPE : (LAMP_TYPE_BY_ROOM[roomType] ?? DEFAULT_LAMP_TYPE)

/** One lighting point per indoor ceiling light of the plan, with the lamp of its room. */
export function lightPointsOf(plan: Plan, items: readonly ResultItem[], outbuildingIds: readonly string[]): LightPoint[] {
  const points: LightPoint[] = []
  for (const item of items) {
    if (item.outdoor || item.category !== 'ceiling_light') continue
    const room = plan.rooms.find((candidate) => candidate.id === item.room && candidate.floor === item.floor)
    if (!room) continue
    points.push({ id: item.id, room: room.id, floor: room.floor, lamp: lampTypeOfRoom(room.type, outbuildingIds.includes(room.id)) })
  }
  return points
}
