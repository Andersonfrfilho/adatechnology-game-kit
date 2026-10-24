import { GROUND } from '../types'
import { unionOf } from '../geometry'
import type { BuildContext } from './context'

/** Cantilevered balconies: a slab tied to the floor of its storey, or on a pillar of its own when it is at ground level. */
export function addBalconies(context: BuildContext): void {
  const { builder, construction, system } = context
  for (const room of context.source.rooms.filter((r) => r.type === 'balcony' && r.floor >= 0)) {
    const floor = room.floor
    const box = unionOf(room.parts)
    const base = floor === 0 ? undefined : context.baseOf(floor)
    const deck = builder.add({ id: `slab_${floor}_${room.id}`, role: 'slab', material: construction.frame.slabs, aabb: box, y0: context.level(floor) - system.slabThickness, y1: context.level(floor) }, { floor })
    if (base) {
      builder.rest(deck, base, system.joints.slab)
      continue
    }
    const pillar = builder.add({ id: `balcony_column_${room.id}`, role: 'column', material: construction.frame.pillars, aabb: [box[0] - 0.08, box[1] - 0.08, box[0] + 0.08, box[1] + 0.08], y0: 0, y1: context.level(floor) - system.slabThickness }, { floor: 0 })
    builder.rest(pillar, GROUND, 'rebar')
    builder.rest(deck, pillar, 'rebar')
  }
}
