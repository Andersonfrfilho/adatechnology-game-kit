import { ROOF_COVERINGS } from '../registry'
import type { BuildContext } from './context'

const ROOF_RISE = 0.6

/** A porch under the top storey has a roof of its own, resting on its posts and on the wall of the house. */
export function addPorchRoofs(context: BuildContext): void {
  const { builder, construction } = context
  for (const room of context.source.rooms.filter((r) => r.type === 'porch')) {
    const floor = room.floor
    const rect = room.parts[0]!
    const posts = context.porches.get(room.id)
    if (floor !== context.floorCount - 1 || !posts) continue
    const material = ROOF_COVERINGS.get(construction.roof.covering)?.material ?? 'ceramic'
    const roof = builder.add({ id: `porch_roof_${room.id}`, role: 'roof', material, aabb: [rect[0] - 0.3, rect[1] - 0.5, rect[2] + 0.3, rect[3]], y0: posts.ceilingY, y1: posts.ceilingY + ROOF_RISE }, { floor })
    for (const post of posts.posts) builder.rest(roof, post, context.isTimber ? 'nail' : 'bolt')
    const housewalls = context.walls.filter((w) => w.floor === floor && !w.exterior && w.sides.includes(room.id) && w.type === 'wall')
    for (const wall of housewalls) {
      if (context.porchRoofOnPostsOnly) builder.supports.push({ part: roof.id, on: wall.id, joint: 'nail', bears: false })
      else builder.rest(roof, context.wallParts.get(wall.id)!, 'nail')
    }
  }
}
