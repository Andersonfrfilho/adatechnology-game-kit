import { touches, unionOf } from '../geometry'
import type { BuildContext } from './context'
import { addDeck, addJoists } from './floor-deck'

/** The floor of the storey above `floor`: a concrete slab, or joists and boards in timber, resting on what carries `floor`. */
export function addUpperFloor(context: BuildContext, floor: number): void {
  if (floor >= context.floorCount - 1 || context.isUnit) return
  const next = floor + 1
  const rects = context.rectsOf(next, ['balcony', 'porch', 'void'])
  const box = rects.length ? unionOf(rects) : context.houseBox
  const carriers = context.carriers.get(floor)!
  const { system, construction, builder } = context
  const thickness = system.slabThickness
  if (context.isTimber) {
    const joists = addJoists(context, { floor: next, box, thickness, carriers, material: construction.frame.timber, joint: system.joints.beam })
    addDeck(context, `slab_${next}`, construction.frame.slabs, { floor: next, box, thickness, joint: system.joints.slab }, joists)
    return
  }
  const slab = builder.add({ id: `slab_${next}`, role: 'slab', material: construction.frame.slabs, aabb: box, y0: context.level(next) - thickness, y1: context.level(next) }, { floor: next, footprint: rects.length ? rects : [context.houseBox] })
  const below = carriers.filter((carrier) => carrier.y0 <= slab.y0 + 0.05)
  // (the slab is over the rooms of the storey, its footprint: what stands under the rest of its box, a terrace's corner, does not carry it; the Visor de
  // casas 3D, reproduced for the team's golden, rests it on all under its box)
  const footprint = context.visorSections ? [slab.aabb] : (slab.footprint ?? [slab.aabb])
  const touching = below.filter((carrier) => footprint.some((rect) => touches(rect, carrier.aabb, context.visorSections ? 0.2 : 0.02)))
  for (const carrier of touching.length ? touching : below) builder.rest(slab, carrier, system.joints.slab)
}
