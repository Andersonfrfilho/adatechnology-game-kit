import { GROUND } from '../types'
import type { Rect } from '../types'
import type { BuildContext } from './context'

const RISER = 0.18
const TREAD = 0.28

const stepCount = (elevation: number): number => Math.max(1, Math.ceil(elevation / RISER))

/** Steps from each porch door down to the ground: concrete in masonry, wood otherwise, resting on the porch floor. */
function addPorchSteps(context: BuildContext): void {
  const { builder } = context
  for (const room of context.source.rooms.filter((r) => r.type === 'porch')) {
    const deck = builder.find(`porch_floor_${room.id}`)
    for (const door of context.source.doors.filter((d) => d.floor === room.floor && d.b === 'outside' && d.a === room.id)) {
      const count = stepCount(context.elevation)
      const depth = count * TREAD
      const aabb: Rect = [door.u - door.width / 2, door.v - depth, door.u + door.width / 2, door.v]
      const flight = builder.add({ id: `steps_${door.id}`, role: 'stair', material: context.isTimber ? 'wood_soft' : 'concrete', aabb, y0: 0, y1: context.level(room.floor) }, { floor: 0, steps: count, door: door.id })
      builder.rest(flight, GROUND, 'resting')
      if (deck) builder.rest(flight, deck, context.isTimber ? 'nail' : 'mortar')
    }
  }
}

function boxOfSteps(door: { u: number; v: number; width: number; axis: string; side?: string }, depth: number): Rect {
  const direction = door.axis === 'u' ? (door.side === 'front' ? -1 : 1) : door.side === 'left' ? -1 : 1
  if (door.axis === 'u') return [door.u - door.width / 2, Math.min(door.v, door.v + direction * depth), door.u + door.width / 2, Math.max(door.v, door.v + direction * depth)]
  return [Math.min(door.u, door.u + direction * depth), door.v - door.width / 2, Math.max(door.u, door.u + direction * depth), door.v + door.width / 2]
}

/** Steps at the other outside doors of the ground storey when the floor sits above the ground. */
function addDoorSteps(context: BuildContext): void {
  if (context.elevation <= 0.1) return
  const { builder } = context
  const doors = context.source.doors.filter((d) => d.floor === 0 && d.exterior && d.model !== 'steel' && d.type !== 'steps' && d.type !== 'zipper')
  for (const door of doors) {
    const count = stepCount(context.elevation)
    const depth = Math.min(TREAD * count, 0.9)
    const flight = builder.add({ id: `steps_${door.id}`, role: 'stair', material: context.isTimber ? 'wood_soft' : 'concrete', aabb: boxOfSteps(door, depth), y0: 0, y1: context.level(0) }, { floor: 0, steps: count, door: door.id })
    builder.rest(flight, GROUND, 'resting')
    const base = context.base0
    if (base && base !== GROUND) builder.rest(flight, base, context.isTimber ? 'nail' : 'mortar')
  }
}

export function addExteriorSteps(context: BuildContext): void {
  addPorchSteps(context)
  addDoorSteps(context)
}
