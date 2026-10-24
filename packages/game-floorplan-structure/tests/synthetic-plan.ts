import type { Construction, Rect, SourceDoor, SourceWall, StructureExtras, StructureSource } from '../src'

export interface HouseShape {
  width?: number
  depth?: number
  floors?: number
  ceiling?: number
  /** A porch of this depth in front of the house (0: none). */
  porch?: number
  roof?: string
  construction?: Construction
  extras?: StructureExtras
}

const wall = (floor: number, axis: 'u' | 'v', u0: number, v0: number, u1: number, v1: number, sides: [string, string], exterior: boolean, ceiling: number): SourceWall => ({
  floor, axis, u0, v0, u1, v1, thickness: 0.15, sides, exterior, type: 'wall', h: ceiling,
})

/** A rectangular house the size of a small cabin: one room per storey, exterior walls on four sides and, with a porch, the wall between porch and house. */
export function rectangularHouse(shape: HouseShape = {}): StructureSource {
  const { width = 6, depth = 5, floors = 1, ceiling = 2.6, porch = 0, roof = 'colonial' } = shape
  const front = porch
  const house: Rect = [0, front, width, front + depth]
  const rooms: StructureSource['rooms'] = []
  const walls: SourceWall[] = []
  for (let floor = 0; floor < floors; floor++) {
    const id = floor === 0 ? 'living' : `room_${floor}`
    rooms.push({ id, type: 'living', floor, parts: [house], ceiling })
    walls.push(
      wall(floor, 'u', house[0], house[1], house[2], house[1], [porch && floor === 0 ? 'porch' : 'outside', id], porch === 0 || floor > 0, ceiling),
      wall(floor, 'u', house[0], house[3], house[2], house[3], [id, 'outside'], true, ceiling),
      wall(floor, 'v', house[0], house[1], house[0], house[3], ['outside', id], true, ceiling),
      wall(floor, 'v', house[2], house[1], house[2], house[3], [id, 'outside'], true, ceiling),
    )
  }
  const doors: SourceDoor[] = []
  if (porch) {
    rooms.push({ id: 'porch', type: 'porch', floor: 0, parts: [[0, 0, width, porch]], ceiling })
    doors.push({ id: 'd0_0', floor: 0, a: 'porch', b: 'outside', exterior: true, type: 'steps', u: width / 2, v: 0, width: 1.2, axis: 'u', side: 'front' })
  }
  return {
    floors: Array.from({ length: floors }, (_, index) => ({ y0: index * ceiling, ceiling })), rooms, walls, doors, items: [], facade: { roof, finish: 'roughcast' }, style: 'mid', template: 'synthetic', w: width, d: front + depth,
    ...(shape.construction ? { construction: shape.construction } : {}), ...(shape.extras ? { structureExtras: shape.extras } : {}),
  }
}
