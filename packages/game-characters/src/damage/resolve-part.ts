import type { BodyRegion, DestructibleSpec, Vec3 } from '@adatechnology/game-contracts'

import type { BodyState } from '../body/body-state'
import { isBodyRegion, REGION_SEGMENTS } from '../body/regions'
import { isSegmentId } from '../body/segment-tree'
import type { SegmentId } from '../body/segment-tree'
import { distance } from '../body/transform'

const radiusOf = (part: DestructibleSpec['parts'][number]): number => (part.shape.kind === 'box' ? Math.min(...part.shape.size) / 2 : part.shape.radius)

/**
 * The segment a hit lands on: `hit.part` when the caller resolved it (a segment id, or a region id for its first segment), else the attached
 * part whose surface is nearest to the local point.
 */
export const resolveSegment = (body: BodyState, spec: DestructibleSpec, part: string | undefined, localPoint: Vec3): SegmentId => {
  if (part !== undefined && isSegmentId(part)) return part
  if (part !== undefined && isBodyRegion(part)) return REGION_SEGMENTS[part][0] as SegmentId
  let best: SegmentId = 'torso'
  let bestGap = Infinity
  for (const candidate of spec.parts) {
    const segment = body.segments.find((entry) => entry.id === candidate.id)
    if (!segment?.attached) continue
    const gap = distance(candidate.position, localPoint) - radiusOf(candidate)
    if (gap < bestGap) [best, bestGap] = [segment.id, gap]
  }
  return best
}

export const regionOfSegment = (body: BodyState, id: SegmentId): BodyRegion => body.segments.find((segment) => segment.id === id)?.region ?? 'torso'
