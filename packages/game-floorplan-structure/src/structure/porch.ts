import { GROUND } from '../types'
import type { Rect, StructurePart } from '../types'
import { touches } from '../geometry'
import type { BuildContext } from './context'

const POST_HALF = 0.08
const FOOTING_HALF = 0.12
const BEAM_DEPTH = 0.2
const BEAM_WIDTH = 0.16

/** Footings and posts under the porch roof: two at the front corners and one more in the middle of a wide porch. */
function addPosts(context: BuildContext, porchId: string, rect: Rect, deck: StructurePart, floor: number): StructurePart[] {
  const { builder, construction } = context
  const hasUpperFloor = floor < context.floorCount - 1
  const ceilingY = hasUpperFloor ? context.level(floor + 1) - context.system.slabThickness : context.level(floor) + context.ceilingOf(floor)
  const deckDepth = Math.min(0.2, Math.max(0.06, context.elevation * 0.5))
  const spots: [number, number][] = [[rect[0] + 0.1, rect[1] + 0.1], [rect[2] - 0.1, rect[1] + 0.1]]
  if (rect[2] - rect[0] > 4.5) spots.push([(rect[0] + rect[2]) / 2, rect[1] + 0.1])
  const posts = spots.map(([u, v], k) => {
    const footing = builder.add({ id: `porch_footing_${porchId}_${k}`, role: 'column', material: 'concrete', aabb: [u - FOOTING_HALF, v - FOOTING_HALF, u + FOOTING_HALF, v + FOOTING_HALF], y0: 0, y1: context.level(floor) - deckDepth }, { floor: 0 })
    builder.rest(footing, GROUND, 'resting')
    builder.rest(deck, footing, 'resting')
    const material = context.isTimber ? construction.frame.timber : construction.frame.pillars
    const post = builder.add({ id: `porch_post_${porchId}_${k}`, role: 'column', material, aabb: [u - POST_HALF, v - POST_HALF, u + POST_HALF, v + POST_HALF], y0: context.level(floor), y1: hasUpperFloor ? ceilingY - BEAM_DEPTH : ceilingY }, { floor })
    builder.rest(post, deck, context.isTimber ? 'nail' : 'rebar')
    return post
  })
  context.porches.set(porchId, { posts, ceilingY })
  return posts
}

/** With a storey above the porch, a head beam over the posts and two side beams carry the floor of that storey. */
function addUpperBeams(context: BuildContext, porchId: string, rect: Rect, posts: StructurePart[], floor: number): void {
  const { builder, construction } = context
  const material = context.isTimber ? construction.frame.timber : construction.frame.beams
  const joint = context.isTimber ? 'nail' : 'rebar'
  const ceilingY = context.porches.get(porchId)!.ceilingY
  const y0 = ceilingY - BEAM_DEPTH
  const carriers = context.carriers.get(floor)!
  const head = builder.add({ id: `porch_beam_${porchId}`, role: 'beam', material, aabb: [rect[0], rect[1], rect[2], rect[1] + BEAM_WIDTH], y0, y1: ceilingY }, { floor })
  for (const post of posts) builder.rest(head, post, joint)
  carriers.push(head)
  const sides: [string, Rect, StructurePart][] = [['e', [rect[0], rect[1], rect[0] + BEAM_WIDTH, rect[3]], posts[0]!], ['d', [rect[2] - BEAM_WIDTH, rect[1], rect[2], rect[3]], posts[1]!]]
  for (const [name, aabb, post] of sides) {
    const side = builder.add({ id: `porch_beam_${porchId}_${name}`, role: 'beam', material, aabb, y0, y1: ceilingY }, { floor })
    builder.rest(side, post, joint)
    builder.rest(side, head, joint)
    for (const wall of context.walls.filter((w) => w.floor === floor && w.role === 'wall' && touches(w.box, side.aabb, 0.3))) builder.rest(side, context.wallParts.get(wall.id)!, joint)
    carriers.push(side)
  }
}

/** Deck, footings, posts (concrete in masonry, wood in timber houses) and, with a storey above, the beams of every porch of the storey. */
export function addPorches(context: BuildContext, floor: number): void {
  const { builder, construction } = context
  for (const room of context.source.rooms.filter((r) => r.type === 'porch' && r.floor === floor)) {
    const rect = room.parts[0]!
    const base = context.baseOf(floor)
    const deckDepth = Math.min(0.2, Math.max(0.06, context.elevation * 0.5))
    const deck = builder.add({ id: `porch_floor_${room.id}`, role: 'slab', material: context.isTimber ? 'wood_soft' : construction.frame.slabs, aabb: rect, y0: context.level(floor) - deckDepth, y1: context.level(floor) }, { floor })
    if (base && base !== GROUND) builder.rest(deck, base, context.isTimber ? 'nail' : context.system.joints.slab)
    const posts = addPosts(context, room.id, rect, deck, floor)
    if (floor < context.floorCount - 1) addUpperBeams(context, room.id, rect, posts, floor)
  }
}
